"""Regression tests for the crime ETL's suburb-name matching and offence mapping."""

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import etl_crime as etl  # noqa: E402


class NswNameNormalisationTests(unittest.TestCase):
    def test_cross_state_suffix_is_removed(self):
        # geo_sal 'Abbotsford (NSW)' ↔ BOCSAR 'Abbotsford'
        self.assertEqual(etl.norm_nsw("Abbotsford (NSW)"), etl.norm_nsw("Abbotsford"))

    def test_lga_disambiguator_is_kept(self):
        # geo_sal 'Darlington (Sydney - NSW)' ↔ BOCSAR 'Darlington (Sydney)'
        self.assertEqual(etl.norm_nsw("Darlington (Sydney - NSW)"), etl.norm_nsw("Darlington (Sydney)"))

    def test_same_name_in_another_lga_does_not_collapse(self):
        # The VIC norm() strips every suffix; for NSW that would merge a Sydney
        # suburb with a regional namesake and double-count its incidents.
        self.assertNotEqual(etl.norm_nsw("Darlington (Sydney - NSW)"), etl.norm_nsw("Darlington (Singleton)"))


class NswOffenceMappingTests(unittest.TestCase):
    def test_break_and_enter_comes_from_theft_subcategories(self):
        self.assertEqual(etl.NSW_MAP["Break and enter dwelling"], "break_enter")
        self.assertEqual(etl.NSW_MAP["Break and enter non-dwelling"], "break_enter")

    def test_fraud_and_arson_fall_to_other_like_vic(self):
        self.assertNotIn("Fraud", etl.NSW_MAP)
        self.assertNotIn("Arson", etl.NSW_MAP)

    def test_transport_regulatory_offences_are_excluded(self):
        self.assertIn("Transport regulatory offences", etl.NSW_EXCLUDE)


if __name__ == "__main__":
    unittest.main()
