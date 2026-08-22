"""Regression tests for the dwelling-structure ETL's source-code mapping."""

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import etl_dwelling_structure as etl  # noqa: E402


class SalCodeNormalisationTests(unittest.TestCase):
    def test_gcp_sal_prefix_is_removed(self):
        self.assertEqual(etl.normalise_sal_code("SAL10002"), "10002")

    def test_existing_asgs_code_is_unchanged(self):
        self.assertEqual(etl.normalise_sal_code("10002"), "10002")


if __name__ == "__main__":
    unittest.main()
