import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("rebuild", Path(__file__).with_name("rebuild-member-entitlements.py"))
rebuild = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rebuild)


class EventPermissionPreservation(unittest.TestCase):
    def test_array_roundtrip(self):
        permissions = ["2026-jinmu-am", "existing-member-permission"]
        self.assertEqual(rebuild.decode_value(rebuild.encode_value(permissions)), permissions)

    def test_event_only_member_is_not_deleted(self):
        records = {"memberEntitlements": {"fixture@gmail.com": {"fields": {"permissions": ["2026-jinmu-am"]}}}}
        rebuild.list_collection = lambda collection: records.get(collection, {})
        deleted, patches = [], []
        rebuild.delete_entitlement = deleted.append
        rebuild.patch_entitlement = lambda email, fields: patches.append((email, fields))
        self.assertEqual(rebuild.main(), 0)
        self.assertEqual(deleted, [])
        self.assertEqual(len(patches), 1)
        self.assertNotIn("permissions", patches[0][1])


if __name__ == "__main__":
    unittest.main()
