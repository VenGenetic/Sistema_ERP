# Graph Report - C:\Users\ASUS\Documents\Xsistem\Sistema_ERP-main\Sistema_ERP-main  (2026-07-29)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 736 nodes · 1243 edges · 79 communities (57 shown, 22 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Products.tsx
- ProductDemands.tsx
- supabaseClient.ts
- App.tsx
- usePOEStore.ts
- devDependencies
- dependencies
- Settings.tsx
- compilerOptions
- supabase
- POS.tsx
- BulkEditModal.tsx
- supabase.ts
- Inventory.tsx
- Orders.tsx
- upload_inventory.js
- deviceDetection.ts
- export_product_images.js
- index.tsx
- TagManager.tsx
- BatchProductEntry.tsx
- DailyRegistry.tsx
- upload_local_images.js
- Layout.tsx
- ProductModal.tsx
- sync-odoo-products.js
- apply-migration.js
- wipe_db.js
- import-products.js
- sync-importer-stock.js
- InventoryGroupSelectModal.tsx
- check_deps.js
- check_discrepancy.js
- check_excel.js
- check_excel_extended.js
- transfer_to_guayaquil.js
- upload_to_supabase.js
- log-env-keys.js
- apply-migration-stock-filter.js
- export_guayaquil_json.js
- update_product_names.js
- temp-migration.js
- BulkMediaUploadModal.tsx
- debug_accounts.cjs
- check_inventory.cjs
- check_inventory.js
- check_categories.js
- check_transaction.js
- fix_categories_data.cjs
- fix_types.cjs
- generate_sql.cjs
- import_lista_precios.py
- upload_local_images.py
- check_db.js
- PartnerModal.tsx
- find_numeric.js
- actualizar_stock_importadora.py
- check_all_tables.js
- list_accounts.js
- test_demand_query.js
- test_expenses_db.js
- excel_to_json.py
- pdf_to_excel.py
- imports
- test-connection.js
- test-counts.js
- test_image.js
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `supabase` - 59 edges
2. `useAuth()` - 17 edges
3. `getThumbnailUrl()` - 17 edges
4. `compilerOptions` - 16 edges
5. `MobileLabels()` - 15 edges
6. `getPrintQueue()` - 15 edges
7. `PrintQueuePreviewModal()` - 13 edges
8. `Products()` - 12 edges
9. `usePOEStore` - 11 edges
10. `isProductDiscontinued()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Inventory()` --calls--> `getThumbnailUrl()`  [EXTRACTED]
  pages/Inventory.tsx → utils/image.ts
- `Layout()` --calls--> `useAuth()`  [EXTRACTED]
  components/Layout.tsx → contexts/AuthContext.tsx
- `PrintQueuePreviewModalProps` --references--> `PrintQueueItem`  [EXTRACTED]
  components/PrintQueuePreviewModal.tsx → utils/mobilePrintQueue.ts
- `ProductDemandModal()` --calls--> `isProductDiscontinued()`  [EXTRACTED]
  components/ProductDemandModal.tsx → utils/discontinuedHelper.ts
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  components/ProtectedRoute.tsx → contexts/AuthContext.tsx

## Import Cycles
- None detected.

## Communities (79 total, 22 thin omitted)

### Community 0 - "Products.tsx"
Cohesion: 0.09
Nodes (55): MediaItem, MediaLightbox(), MediaLightboxProps, MobileSearchBar(), MobileSearchBarProps, Window, PrintQueuePreviewModal(), PrintQueuePreviewModalProps (+47 more)

### Community 1 - "ProductDemands.tsx"
Cohesion: 0.06
Nodes (46): EditDemandModal(), EditDemandModalProps, ProductDemand, ExportDemandsModal(), ExportDemandsModalProps, ProductDemand, parseClipboardText(), ProductDemandModal() (+38 more)

### Community 2 - "supabaseClient.ts"
Cohesion: 0.14
Nodes (24): AccountDetails(), TransactionDisplay, FinanceConfig(), FinanceDashboard(), SortableAccountCard(), NewTransactionModal(), NewTransactionModalProps, TempLine (+16 more)

### Community 3 - "App.tsx"
Cohesion: 0.06
Nodes (31): AdminSetup, AuthConfirm, CommissionDashboard, Customers, DailyRegistry, Dashboard, Expenses, Finance (+23 more)

### Community 4 - "usePOEStore.ts"
Cohesion: 0.18
Nodes (23): POECell(), POECellProps, POEModal(), POETable(), SidePeekConsole(), Props, SOPTypeAEditor(), Props (+15 more)

### Community 5 - "devDependencies"
Cohesion: 0.07
Nodes (25): dotenv, devDependencies, dotenv, @types/node, @types/react, @types/react-dom, typescript, vite (+17 more)

### Community 6 - "dependencies"
Cohesion: 0.07
Nodes (28): @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, html2canvas, jsbarcode, jszip, lucide-react, dependencies (+20 more)

### Community 7 - "Settings.tsx"
Cohesion: 0.10
Nodes (13): InviteUserModal(), InviteUserModalProps, TODO: Implement Supabase invite logic, AccountPanel(), ApiKey, ApiKeysPanel(), Brand, BrandsPanel() (+5 more)

### Community 8 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2022, node, supabase/functions, vite/client, compilerOptions, allowImportingTsExtensions (+15 more)

### Community 9 - "supabase"
Cohesion: 0.09
Nodes (7): CatalogImportWizard(), CatalogImportWizardProps, CatalogRow, GroupData, GroupItem, DailyStats, supabase

### Community 10 - "POS.tsx"
Cohesion: 0.18
Nodes (17): PaymentModal(), PaymentModalProps, todayEcuador(), useBarcodeScanner(), CustomerRequest, Customers(), formatRequestNotes(), parseRequestReminder() (+9 more)

### Community 11 - "BulkEditModal.tsx"
Cohesion: 0.20
Nodes (13): BULK_FIELDS, BulkEditModal(), BulkEditModalProps, BulkFieldKey, calcPrice(), costWithVat(), r(), Warehouse (+5 more)

### Community 12 - "supabase.ts"
Cohesion: 0.13
Nodes (14): InventoryMovementModal(), InventoryMovementModalProps, Product, Warehouse, CompositeTypes, Constants, Database, DatabaseWithoutInternals (+6 more)

### Community 13 - "Inventory.tsx"
Cohesion: 0.16
Nodes (11): FitmentSearch(), FitmentSearchProps, PartProfileModal(), PartProfileModalProps, CalculatedValues, CostFormState, ProductEntryForm(), Inventory() (+3 more)

### Community 14 - "Orders.tsx"
Cohesion: 0.16
Nodes (10): columns, Order, OrderItem, Orders(), isTransitionAllowed(), OrderStatus, STATUS_COLORS, STATUS_LABELS (+2 more)

### Community 15 - "upload_inventory.js"
Cohesion: 0.15
Nodes (10): __dirname, excelData, __filename, finalInventoryUpload, jsonDataStr, jsonParsed, matchedProducts, parsedExcel (+2 more)

### Community 16 - "deviceDetection.ts"
Cohesion: 0.27
Nodes (8): ProtectedRoute(), SessionTimeoutHandler(), AuthMode, Login(), getPreferredViewMode(), isMobileDevice(), shouldRedirectToMobile(), ViewMode

### Community 17 - "export_product_images.js"
Cohesion: 0.21
Nodes (11): buildSkuMap(), __dirname, downloadImage(), envContent, envPath, envVars, exportDir, __filename (+3 more)

### Community 18 - "index.tsx"
Cohesion: 0.20
Nodes (6): App(), ErrorBoundary, Props, State, root, rootElement

### Community 19 - "TagManager.tsx"
Cohesion: 0.24
Nodes (5): QuickTagAssignModalProps, COLORS, Props, Tag, TagManager()

### Community 20 - "BatchProductEntry.tsx"
Cohesion: 0.25
Nodes (7): Account, BatchProductEntry(), BatchProductEntryProps, ProductRow, Brand, BrandSelect(), BrandSelectProps

### Community 21 - "DailyRegistry.tsx"
Cohesion: 0.31
Nodes (8): DailyRegistry(), DailySummary, EditCartItem, nDaysAgoLocal(), Order, OrderItem, todayLocal(), toLocalDate()

### Community 22 - "upload_local_images.js"
Cohesion: 0.25
Nodes (8): __dirname, envContent, envPath, envVars, __filename, main(), processBatch(), supabase

### Community 23 - "Layout.tsx"
Cohesion: 0.43
Nodes (4): HeaderAccount(), Layout(), MobileLayout(), setPreferredViewMode()

### Community 24 - "ProductModal.tsx"
Cohesion: 0.71
Nodes (6): calcMargin(), calcPrice(), costWithVat(), ProductModal(), ProductModalProps, r()

### Community 25 - "sync-odoo-products.js"
Cohesion: 0.29
Nodes (5): __dirname, __filename, jsonPath, localImagesDir, supabase

### Community 26 - "apply-migration.js"
Cohesion: 0.33
Nodes (4): __dirname, envPath, __filename, migrationPath

### Community 27 - "wipe_db.js"
Cohesion: 0.40
Nodes (5): __dirname, __filename, supabase, wipe(), wipeTable()

### Community 28 - "import-products.js"
Cohesion: 0.33
Nodes (4): __dirname, __filename, jsonPath, supabase

### Community 29 - "sync-importer-stock.js"
Cohesion: 0.33
Nodes (4): __dirname, __filename, jsonPath, supabase

### Community 30 - "InventoryGroupSelectModal.tsx"
Cohesion: 0.40
Nodes (4): GroupData, InventoryGroupSelectModal(), InventoryGroupSelectModalProps, SuccessState

### Community 31 - "check_deps.js"
Cohesion: 0.40
Nodes (3): __dirname, __filename, supabase

### Community 32 - "check_discrepancy.js"
Cohesion: 0.40
Nodes (3): __dirname, __filename, supabase

### Community 33 - "check_excel.js"
Cohesion: 0.40
Nodes (4): data, __dirname, __filename, workbook

### Community 34 - "check_excel_extended.js"
Cohesion: 0.40
Nodes (4): data, __dirname, __filename, workbook

### Community 35 - "transfer_to_guayaquil.js"
Cohesion: 0.40
Nodes (3): __dirname, __filename, supabase

### Community 36 - "upload_to_supabase.js"
Cohesion: 0.40
Nodes (3): __dirname, __filename, supabase

### Community 37 - "log-env-keys.js"
Cohesion: 0.40
Nodes (4): __dirname, envContent, envPath, __filename

### Community 38 - "apply-migration-stock-filter.js"
Cohesion: 0.40
Nodes (3): __dirname, __filename, migrationPath

### Community 39 - "export_guayaquil_json.js"
Cohesion: 0.40
Nodes (3): __dirname, __filename, supabase

### Community 40 - "update_product_names.js"
Cohesion: 0.40
Nodes (3): __dirname, __filename, supabase

### Community 41 - "temp-migration.js"
Cohesion: 0.40
Nodes (3): __dirname, envPath, __filename

### Community 42 - "BulkMediaUploadModal.tsx"
Cohesion: 0.50
Nodes (3): BulkMediaUploadModal(), BulkMediaUploadModalProps, FileValidation

### Community 50 - "generate_sql.cjs"
Cohesion: 0.50
Nodes (3): files, fs, path

### Community 51 - "import_lista_precios.py"
Cohesion: 0.83
Nodes (3): clean_price(), escape_sql(), main()

### Community 52 - "upload_local_images.py"
Cohesion: 0.83
Nodes (3): load_env(), main(), upload_and_link_image()

## Knowledge Gaps
- **296 isolated node(s):** `Dashboard`, `Team`, `Customers`, `Inventory`, `Products` (+291 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `supabase` connect `supabase` to `Products.tsx`, `ProductDemands.tsx`, `supabaseClient.ts`, `usePOEStore.ts`, `Settings.tsx`, `BulkMediaUploadModal.tsx`, `BulkEditModal.tsx`, `supabase.ts`, `Inventory.tsx`, `POS.tsx`, `Orders.tsx`, `deviceDetection.ts`, `TagManager.tsx`, `BatchProductEntry.tsx`, `DailyRegistry.tsx`, `Layout.tsx`, `ProductModal.tsx`, `InventoryGroupSelectModal.tsx`?**
  _High betweenness centrality (0.157) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `Products.tsx`, `ProductDemands.tsx`, `devDependencies`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `jspdf` connect `Products.tsx` to `dependencies`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `Dashboard`, `Team`, `Customers` to the rest of the system?**
  _296 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Products.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09440993788819876 - nodes in this community are weakly interconnected._
- **Should `ProductDemands.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05928614640048397 - nodes in this community are weakly interconnected._
- **Should `supabaseClient.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1379800853485064 - nodes in this community are weakly interconnected._