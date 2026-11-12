# Authentication migration rehearsal

PASS: restored current live backup into a separate marked disposable PostgreSQL cluster.

18 built-in Django migrations applied only to jedel_auth_rehearsal. System checks and role setup passed.

Business record, captured-price, stock, column, identity and constraint fingerprints matched before/after for all four tables. Live database migrations remain NOT APPLIED.

Private backup SHA256: `b925c942f036d1ceb3f439327e658e44938e9363c73b634ce8bb24f8ad63756b`

| Business table | Data fingerprint | Schema fingerprint |
|---|---|---|
| suppliers | 2d0f3f20d4bf56f9f2bbc42979e5ab5ff4134d1e53265428c602e7d2cc7376f4 | 38a14b2c4f046abb5f6ec4df5c35c640d14f182525a01c8632034ae151b961f2 |
| products | 5fef702b7d1d0a7e516f4be09f0ce69338ae292a137cf126edaedae042d262a5 | 8f4a98d490479464a091ac2af7fcb4e60aed386a4441834f005724d3ed101a6c |
| purchase_orders | af1f5cf2a0d3e82544ed425b9a3fc7c6f5319a61922f90062489ee2d45d2a1cc | cfe0b09f67ea206ecec08299986142a646af157012dc491bbad3dd41a23d325f |
| purchase_order_items | b0880b0d728c0384135731a12e64133a3143abca50a963c2276cf7649f6245ed | 9c34df9cd0e7d9010f7e824ddb5fa0859d29fc77a320e71a3fee67284a584a42 |

Restore used --no-owner --no-acl in the disposable cluster. Original-owner/runtime GRANT validation remains a deployment gate. Backup is private and Git-ignored. No live records were rewritten or orders replayed.
