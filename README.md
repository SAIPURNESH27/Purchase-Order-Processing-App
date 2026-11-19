# Purchase Order Processing – v3 (BAS-ready)

This version is rebuilt so the UI does not depend on SAPUI5 OData V4 model bindings for the main data screens. The Fiori application uses the CAP OData V4 endpoints through `fetch`, while the CAP service remains the source of truth.

## Included functionality
- Procurement dashboard with live KPIs and spend from PurchaseOrders + PurchaseOrderItems
- Purchase Order list with search/filter
- Purchase Order detail
- Create Purchase Order
- Edit Purchase Order
- Add/remove PO items
- Automatic item net value, GST 18% and total calculation
- Approve / Reject pending Purchase Orders
- Cancel Purchase Order
- Approval worklist with Pending / Approved / Rejected tabs
- Supplier list, search/filter and Create Supplier
- CAP OData V4 backend
- SQLite database
- Seed CSV data for 10 Purchase Orders, PO items, 6 suppliers and approvals

## Dependencies
The project is pinned to the compatible CAP 9 / SQLite 2 combination:
- @sap/cds 9.9.3
- @cap-js/sqlite 2.1.1
- @sap/cds-dk 9.9.3

## Run in SAP Business Application Studio
```bash
npm install
npx cds watch
```

Open the application from BAS port 4004:
```text
/purchase-order-processing/index.html
```

For example, through the BAS forwarded port:
```text
https://<your-4004-forwarded-host>/purchase-order-processing/index.html
```

## Verify backend before opening UI
```bash
curl http://localhost:4004/odata/v4/purchase-order-service/PurchaseOrders
curl http://localhost:4004/odata/v4/purchase-order-service/Suppliers
```

The first command should return the seeded Purchase Orders, including 45000123, 45000124, 45000125, etc.

## If an old SQLite database exists
Stop `cds watch`, then recreate it:
```bash
rm -f db.sqlite
npx cds deploy --to sqlite:db.sqlite
npx cds watch
```

Do not run `npm install @cap-js/sqlite` without a version in this CAP 9 project; the current latest major requires CAP 10. `npm install` from this package.json installs the compatible version automatically.


