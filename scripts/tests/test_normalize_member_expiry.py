import importlib.util
from pathlib import Path
import unittest
import tempfile
import json
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

spec = importlib.util.spec_from_file_location('migration', Path(__file__).parents[1] / 'normalize-member-expiry.py')
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


def document(expiry):
    return {'name': 'projects/demo-test/databases/(default)/documents/memberAccess/test',
            'updateTime': '2026-09-01T00:00:00Z',
            'fields': {'expiresAt': expiry, 'articleAccess': {'booleanValue': False}}}


class MigrationTests(unittest.TestCase):
    def test_preserves_instant_including_expired_date_and_offset(self):
        self.assertEqual(migration.timestamp_string('2020-01-01T23:59:59+08:00'), '2020-01-01T15:59:59.000000Z')
        self.assertEqual(migration.timestamp_string('2027-01-01T00:00:00.123Z'), '2027-01-01T00:00:00.123000Z')

    def test_rejects_ambiguous_and_invalid_dates(self):
        for value in ['2026-09-18', '2026-09-18T00:00:00', '2026-02-30T00:00:00Z', '', 'forever', 123]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                migration.timestamp_string(value)

    def test_timestamp_and_absent_expiry_unchanged(self):
        for value in [{'timestampValue': '2027-01-01T00:00:00Z'}, {'nullValue': None}]:
            self.assertIsNone(migration.plan_document(document(value)))
        self.assertIsNone(migration.plan_document({'fields': {}}))

    def test_patch_only_expiry_with_concurrent_update_guard(self):
        original = document({'stringValue': '2020-01-01T00:00:00Z'})
        change = migration.plan_document(original)
        url, body = migration.patch_request(change)
        query = parse_qs(urlparse(url).query)
        self.assertEqual(query['updateMask.fieldPaths'], ['expiresAt'])
        self.assertEqual(query['currentDocument.updateTime'], [original['updateTime']])
        self.assertEqual(list(body['fields']), ['expiresAt'])
        self.assertEqual(original['fields']['articleAccess'], {'booleanValue': False})
        self.assertEqual(change['before'], original['fields']['expiresAt'])
        self.assertIsNone(migration.plan_document(document(change['after'])))

    def test_dry_run_and_invalid_apply_never_write(self):
        for apply, invalid in [(False, []), (True, [{'reason': 'bad date'}])]:
            with self.subTest(apply=apply), tempfile.TemporaryDirectory() as directory:
                target = str(Path(directory) / 'report.json')
                report = {'scanned': 1, 'changes': [migration.plan_document(document({'stringValue': '2020-01-01T00:00:00Z'}))], 'invalid': invalid}
                argv = ['migration', '--project', 'demo-test', '--report', target] + (['--apply'] if apply else [])
                with patch('sys.argv', argv), patch.object(migration.subprocess, 'check_output', return_value='unused'), patch.object(migration, 'scan', return_value=report), patch.object(migration, 'api') as api:
                    if invalid:
                        with self.assertRaises(SystemExit):
                            migration.main()
                    else:
                        migration.main()
                    api.assert_not_called()
                self.assertEqual(json.loads(Path(target).read_text()), report)
                self.assertEqual(Path(target).stat().st_mode & 0o777, 0o600)

    def test_apply_stops_on_concurrent_update_and_keeps_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            target = str(Path(directory) / 'report.json')
            change = migration.plan_document(document({'stringValue': '2020-01-01T00:00:00Z'}))
            report = {'scanned': 2, 'changes': [change, change], 'invalid': []}
            argv = ['migration', '--project', 'demo-test', '--report', target, '--apply']
            with patch('sys.argv', argv), patch.object(migration.subprocess, 'check_output', return_value='unused'), patch.object(migration, 'scan', return_value=report), patch.object(migration, 'api', side_effect=RuntimeError('precondition failed')) as api:
                with self.assertRaisesRegex(SystemExit, 'Stopped after 0 writes'):
                    migration.main()
                api.assert_called_once()
            self.assertEqual(json.loads(Path(target).read_text()), report)

    def test_scan_both_collections_and_pagination_before_writes(self):
        valid = document({'stringValue': '2020-01-01T00:00:00Z'})
        invalid = document({'stringValue': 'invalid'})
        with patch.object(migration, 'api', side_effect=[
            {'documents': [valid], 'nextPageToken': 'next'},
            {'documents': [invalid]}, {'documents': [valid]}
        ]) as api:
            report = migration.scan('demo-test', 'unused')
        self.assertEqual(report['scanned'], 3)
        self.assertEqual(len(report['changes']), 2)
        self.assertEqual(len(report['invalid']), 1)
        self.assertIn('pageToken=next', api.call_args_list[1].args[0])
        self.assertIn('/sponsorMemberAccess?', api.call_args_list[2].args[0])
        self.assertTrue(all(len(call.args) == 2 for call in api.call_args_list))

    def test_private_backup_is_create_only_and_completes_after_all_chunks(self):
        change = migration.plan_document(document({'stringValue': '2020-01-01T00:00:00Z'}))
        report = {'project': 'demo-test', 'scanned': 401, 'changes': [change] * 401, 'invalid': []}
        with patch.object(migration, 'api') as api:
            migration.backup_report('demo-test', 'unused', 'expiry-test-1', report)
        calls = api.call_args_list
        self.assertEqual([len(call.args[2]['writes']) for call in calls], [400, 1, 1])
        for call in calls:
            self.assertEqual(call.kwargs['method'], 'POST')
            for write in call.args[2]['writes']:
                self.assertIn('/securityMigrationBackups/expiry-test-1', write['update']['name'])
                self.assertEqual(write['currentDocument'], {'exists': False})
        manifest = calls[-1].args[2]['writes'][0]['update']['fields']
        self.assertEqual(manifest['complete'], {'booleanValue': True})
        stored = calls[0].args[2]['writes'][0]['update']['fields']['payload']['stringValue']
        self.assertEqual(json.loads(stored), change)

    def test_backup_failure_prevents_membership_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            report = {'scanned': 1, 'changes': [migration.plan_document(document({'stringValue': '2020-01-01T00:00:00Z'}))], 'invalid': []}
            argv = ['migration', '--project', 'demo-test', '--report', str(Path(directory) / 'report.json'), '--apply', '--backup-id', 'expiry-test-1']
            with patch('sys.argv', argv), patch.object(migration.subprocess, 'check_output', return_value='unused'), patch.object(migration, 'scan', return_value=report), patch.object(migration, 'backup_report', side_effect=RuntimeError('backup failed')), patch.object(migration, 'api') as api:
                with self.assertRaisesRegex(SystemExit, 'Stopped after 0 writes'):
                    migration.main()
                api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
