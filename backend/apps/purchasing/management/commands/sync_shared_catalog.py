"""Apply the versioned shared catalog to an explicitly isolated local database."""
import json
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from apps.purchasing.models import Product, Supplier


class Command(BaseCommand):
    help = "Add missing shared products and suppliers and update changed shared fields."

    def add_arguments(self, parser):
        parser.add_argument("--skip-unless-isolated", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        isolated = (
            os.getenv("JEDEL_ISOLATED_DEVELOPMENT") == "1"
            and connection.settings_dict["NAME"] == "jedel_dev"
            and connection.vendor == "postgresql"
            and settings.DEBUG
        )
        if not isolated:
            if options["skip_unless_isolated"]:
                self.stdout.write("Shared catalog sync skipped: database is not explicitly isolated.")
                return
            raise CommandError("Shared catalog sync requires DEBUG, JEDEL_ISOLATED_DEVELOPMENT=1 and DB_NAME=jedel_dev.")

        with connection.cursor() as cursor:
            tables = set(connection.introspection.table_names(cursor))
            if not {"products", "suppliers"}.issubset(tables):
                if options["skip_unless_isolated"]:
                    self.stdout.write("Shared catalog sync skipped: initialize the isolated database first.")
                    return
                raise CommandError("Initialize the isolated database before syncing its shared catalog.")
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [74832912])
            cursor.execute("LOCK TABLE products, suppliers IN SHARE ROW EXCLUSIVE MODE")

        fixture_path = settings.BASE_DIR.parent / "database" / "shared_catalog.json"
        try:
            fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
            products = fixture["products"]
            suppliers = fixture["suppliers"]
            legacy_names = fixture.get("legacy_product_names", {})
            if fixture["version"] < 1 or not products or not suppliers:
                raise ValueError("unsupported or empty shared catalog")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise CommandError(f"Shared catalog fixture is invalid; no rows changed: {exc}") from exc

        if len({row["product_name"].casefold() for row in products}) != len(products):
            raise CommandError("Shared catalog has duplicate product names; no rows changed.")
        if len({row["email"].casefold() for row in suppliers}) != len(suppliers):
            raise CommandError("Shared catalog has duplicate supplier emails; no rows changed.")

        current_products = list(Product.objects.all())
        current_suppliers = list(Supplier.objects.all())
        by_product_name = {}
        for product in current_products:
            by_product_name.setdefault(product.product_name.casefold(), []).append(product)

        added_products = updated_products = unchanged_products = conflicts = 0
        for source in products:
            name = source["product_name"]
            aliases = [alias.casefold() for alias in legacy_names.get(name, [])]
            matches = []
            for candidate in [name.casefold(), *aliases]:
                matches.extend(by_product_name.get(candidate, []))
            matches = list({row.pk: row for row in matches}.values())
            if len(matches) > 1:
                conflicts += 1
                self.stdout.write(self.style.WARNING(f"Conflict preserved: multiple products match shared item {name!r}."))
                continue
            if not matches:
                # Never shadow an existing locally named product that only differs by a demo label.
                clean_name = name.removeprefix("[JEDEL FICTIONAL] ").removeprefix("[DEMO] ").casefold()
                local_matches = [p for p in current_products if p.product_name.casefold() == clean_name]
                if local_matches:
                    conflicts += 1
                    self.stdout.write(self.style.WARNING(f"Conflict preserved: local product uses the shared name {name!r}."))
                    continue
                created = Product.objects.create(
                    product_name=name,
                    category=source.get("category"),
                    unit_price=source["unit_price"],
                    stock_quantity=source["stock_quantity"],
                )
                current_products.append(created)
                by_product_name.setdefault(name.casefold(), []).append(created)
                added_products += 1
                continue

            product = matches[0]
            changed = (
                product.product_name != name
                or product.category != source.get("category")
                or product.unit_price != source["unit_price"]
            )
            if changed:
                product.product_name = name
                product.category = source.get("category")
                product.unit_price = source["unit_price"]
                product.save(update_fields=["product_name", "category", "unit_price"])
                updated_products += 1
                # Keep the in-memory index consistent for any remaining aliases.
                by_product_name.setdefault(name.casefold(), []).append(product)
            else:
                unchanged_products += 1

        by_supplier_email = {}
        for supplier in current_suppliers:
            by_supplier_email.setdefault(supplier.email.casefold(), []).append(supplier)
        added_suppliers = updated_suppliers = unchanged_suppliers = 0
        for source in suppliers:
            matches = by_supplier_email.get(source["email"].casefold(), [])
            if len(matches) > 1:
                conflicts += 1
                self.stdout.write(self.style.WARNING(f"Conflict preserved: duplicate shared supplier email {source['email']!r}."))
                continue
            if not matches:
                supplier = Supplier.objects.create(
                    supplier_name=source["supplier_name"],
                    email=source["email"],
                    phone=source.get("phone"),
                    address=source.get("address"),
                )
                by_supplier_email.setdefault(source["email"].casefold(), []).append(supplier)
                added_suppliers += 1
                continue
            supplier = matches[0]
            changed_fields = []
            for field in ("supplier_name", "phone", "address"):
                value = source.get(field)
                if getattr(supplier, field) != value:
                    setattr(supplier, field, value)
                    changed_fields.append(field)
            if changed_fields:
                supplier.save(update_fields=changed_fields)
                updated_suppliers += 1
            else:
                unchanged_suppliers += 1

        self.stdout.write(
            "Shared catalog v{}: products +{}/~{}/={} ; suppliers +{}/~{}/={} ; conflicts {}. "
            "Existing stock, local products and all purchase orders/items were preserved.".format(
                fixture["version"], added_products, updated_products, unchanged_products,
                added_suppliers, updated_suppliers, unchanged_suppliers, conflicts,
            )
        )
