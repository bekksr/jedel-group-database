import json
from pathlib import Path
from django.test import SimpleTestCase
from .management.commands.seed_demo import CATALOG, EXTRA_PRODUCTS


class ProductMetadataTests(SimpleTestCase):
    def test_all_demo_products_have_distinct_fictional_descriptions(self):
        path = Path(__file__).resolve().parents[3] / 'frontend/src/app/core/data/product-metadata.ts'
        descriptions = {}
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.startswith('  "'):
                key, value = line.strip().removesuffix(',').split(': ', 1)
                descriptions[json.loads(key)] = json.loads(value)
        names = [name for rows in CATALOG.values() for name, _ in rows] + [name for _, name, _ in EXTRA_PRODUCTS]
        self.assertEqual(len(names), 55)
        self.assertEqual(set(names), set(descriptions))
        self.assertEqual(len(set(descriptions.values())), 55)
        self.assertTrue(all('fictional demonstration' in text.lower() for text in descriptions.values()))
