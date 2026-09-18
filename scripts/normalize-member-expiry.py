#!/usr/bin/env python3
"""Normalize only membership expiresAt fields. Dry-run unless --apply is supplied."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

COLLECTIONS = ('memberAccess', 'sponsorMemberAccess')
ISO_INSTANT = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$')


def timestamp_string(value):
    # No locale-dependent parsing or invented timezone/end-of-day extensions.
    if not isinstance(value, str) or not ISO_INSTANT.fullmatch(value):
        raise ValueError('Expected ISO datetime with explicit timezone')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return parsed.astimezone(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')


def plan_document(document):
    fields = document.get('fields', {})
    expiry = fields.get('expiresAt')
    if expiry is None or 'nullValue' in expiry or 'timestampValue' in expiry:
        return None
    if 'stringValue' not in expiry:
        raise ValueError('Unsupported expiresAt type')
    converted = timestamp_string(expiry['stringValue'])
    if not document.get('updateTime'):
        raise ValueError('Missing document updateTime')
    return {
        'name': document['name'], 'updateTime': document['updateTime'],
        'before': expiry, 'after': {'timestampValue': converted}
    }


def patch_request(change):
    query = urlencode({
        'updateMask.fieldPaths': 'expiresAt',
        'currentDocument.updateTime': change['updateTime']
    })
    return ('https://firestore.googleapis.com/v1/' + quote(change['name'], safe='/()') + '?' + query,
            {'fields': {'expiresAt': change['after']}})


def api(url, token, data=None):
    request = Request(url, data=None if data is None else json.dumps(data).encode(),
                      method='GET' if data is None else 'PATCH', headers={
                          'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'
                      })
    with urlopen(request, timeout=60) as response:
        return json.load(response)


def scan(project, token):
    changes, invalid = [], []
    count = 0
    for collection in COLLECTIONS:
        page = ''
        while True:
            query = urlencode({'pageSize': 300, **({'pageToken': page} if page else {})})
            url = f'https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/{collection}?{query}'
            result = api(url, token)
            for document in result.get('documents', []):
                count += 1
                try:
                    change = plan_document(document)
                    if change:
                        changes.append(change)
                except ValueError as error:
                    invalid.append({'name': document['name'], 'reason': str(error)})
            page = result.get('nextPageToken', '')
            if not page:
                break
    return {'project': project, 'scanned': count, 'changes': changes, 'invalid': invalid}


def write_private_report(path, report):
    # Exclusive creation prevents overwriting an earlier backup. Contains member IDs.
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    parser.add_argument('--report', type=Path, required=True, help='New private report/backup file outside the repository')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]', args.project):
        parser.error('Invalid project ID')
    token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
    report = scan(args.project, token)
    write_private_report(args.report, report)
    print(f"Scanned {report['scanned']}; convertible {len(report['changes'])}; invalid {len(report['invalid'])}.")
    if report['invalid']:
        raise SystemExit('No writes performed: review invalid dates in the private report.')
    if not args.apply:
        print('Dry-run: no writes performed.')
        return
    applied = 0
    try:
        for change in report['changes']:
            url, body = patch_request(change)
            api(url, token, body)
            applied += 1
    except Exception:
        # Do not print HTTP payloads, credentials or member emails to shared logs.
        raise SystemExit(f'Stopped after {applied} writes. No retry/overwrite; rescan using a new report path.') from None
    print(f'Applied {applied} expiry conversions. Rerun dry-run to verify; rebuild entitlements before release.')


if __name__ == '__main__':
    main()
