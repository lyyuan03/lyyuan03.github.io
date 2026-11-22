import datetime as dt
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("rebuild", ROOT / ".github/scripts/rebuild-member-entitlements.py")
rebuild = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rebuild)


def ts(text):
    return dt.datetime.fromisoformat(text.replace("Z", "+00:00"))


class ArticleWindowAnchorTest(unittest.TestCase):
    def test_new_member_after_policy_gets_anchor_from_starts_at(self):
        updates = rebuild.window_anchor_updates(
            {"startsAt": "2026-10-05T00:00:00Z", "expiresAt": "2026-11-04T00:00:00Z"}, True)
        self.assertEqual(updates["articleWindowStartsAt"], ts("2026-10-05T00:00:00Z"))
        self.assertEqual(updates["articleWindowSeenExpiresAt"], ts("2026-11-04T00:00:00Z"))

    def test_continuous_renewal_keeps_anchor_even_when_old_backend_resets_starts_at(self):
        record = {
            "startsAt": "2026-10-30T00:00:00Z",  # 舊版後端續約時把 startsAt 改成續約當天
            "expiresAt": "2026-12-04T00:00:00Z",
            "articleWindowStartsAt": "2026-10-05T00:00:00Z",
            "articleWindowSeenExpiresAt": "2026-11-04T00:00:00Z",
        }
        updates = rebuild.window_anchor_updates(record, True)
        self.assertNotIn("articleWindowStartsAt", updates)
        self.assertEqual(updates["articleWindowSeenExpiresAt"], ts("2026-12-04T00:00:00Z"))
        self.assertEqual(rebuild.article_window_start(record), ts("2026-09-05T00:00:00Z"))

    def test_rejoin_after_lapse_restarts_anchor(self):
        record = {
            "startsAt": "2026-12-20T00:00:00Z",
            "expiresAt": "2027-01-19T00:00:00Z",
            "articleWindowStartsAt": "2026-10-05T00:00:00Z",
            "articleWindowSeenExpiresAt": "2026-11-04T00:00:00Z",
        }
        updates = rebuild.window_anchor_updates(record, True)
        self.assertEqual(updates["articleWindowStartsAt"], ts("2026-12-20T00:00:00Z"))

    def test_pre_policy_member_stays_unrestricted_and_gets_marker(self):
        record = {"startsAt": "2026-09-01T00:00:00Z", "expiresAt": "2026-11-01T00:00:00Z"}
        updates = rebuild.window_anchor_updates(record, True)
        self.assertEqual(updates["articleWindowStartsAt"], rebuild.LEGACY_UNRESTRICTED_ANCHOR)
        self.assertEqual(updates["articleWindowSeenExpiresAt"], ts("2026-11-01T00:00:00Z"))
        self.assertEqual(rebuild.article_window_start(record).year, 1970)
        # 標記寫入後，即使舊版後端把 startsAt 改成續約當天，仍維持不受限制。
        marked = {**record, "startsAt": "2026-10-30T00:00:00Z", "expiresAt": "2026-12-01T00:00:00Z",
                  "articleWindowStartsAt": "1970-01-01T00:00:00Z", "articleWindowSeenExpiresAt": "2026-11-01T00:00:00Z"}
        self.assertNotIn("articleWindowStartsAt", rebuild.window_anchor_updates(marked, True))
        self.assertEqual(rebuild.article_window_start(marked).year, 1970)

    def test_rejoin_within_seven_day_grace_keeps_anchor(self):
        base = {
            "expiresAt": "2027-01-10T00:00:00Z",
            "articleWindowStartsAt": "2026-10-05T00:00:00Z",
            "articleWindowSeenExpiresAt": "2026-11-04T00:00:00Z",
        }
        for starts_at in ("2026-11-08T00:00:00Z", "2026-11-11T00:00:00Z"):  # 到期後第 4、7 天
            updates = rebuild.window_anchor_updates({**base, "startsAt": starts_at}, True)
            self.assertNotIn("articleWindowStartsAt", updates)

    def test_rejoin_after_grace_restarts_anchor(self):
        record = {
            "startsAt": "2026-11-12T00:00:00Z",  # 到期後第 8 天
            "expiresAt": "2027-01-10T00:00:00Z",
            "articleWindowStartsAt": "2026-10-05T00:00:00Z",
            "articleWindowSeenExpiresAt": "2026-11-04T00:00:00Z",
        }
        updates = rebuild.window_anchor_updates(record, True)
        self.assertEqual(updates["articleWindowStartsAt"], ts("2026-11-12T00:00:00Z"))

    def test_legacy_member_lapsing_beyond_grace_restarts_like_new_member(self):
        record = {
            "startsAt": "2026-12-20T00:00:00Z",
            "expiresAt": "2027-01-19T00:00:00Z",
            "articleWindowStartsAt": "1970-01-01T00:00:00Z",
            "articleWindowSeenExpiresAt": "2026-11-01T00:00:00Z",
        }
        updates = rebuild.window_anchor_updates(record, True)
        self.assertEqual(updates["articleWindowStartsAt"], ts("2026-12-20T00:00:00Z"))

    def test_inactive_member_is_untouched(self):
        self.assertEqual(rebuild.window_anchor_updates({"startsAt": "2026-10-05T00:00:00Z"}, False), {})

    def test_no_update_when_already_current(self):
        record = {
            "startsAt": "2026-10-05T00:00:00Z",
            "expiresAt": "2026-11-04T00:00:00Z",
            "articleWindowStartsAt": "2026-10-05T00:00:00Z",
            "articleWindowSeenExpiresAt": "2026-11-04T00:00:00Z",
        }
        self.assertEqual(rebuild.window_anchor_updates(record, True), {})


if __name__ == "__main__":
    unittest.main()
