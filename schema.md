erDiagram
    %% ==========================================
    %% 1. COMMERCE & FULFILLMENT
    %% ==========================================
    CUSTOMERS {
        integer id PK
        text identification_number
        text name
        text customer_type
        uuid claimed_by FK "refs AUTH_USERS"
    }

    ORDERS {
        integer id PK
        integer customer_id FK
        integer warehouse_id FK
        integer partner_id FK
        numeric total_amount
        text status
        uuid created_by FK "refs AUTH_USERS"
        uuid closer_id FK "refs AUTH_USERS"
    }

    ORDER_ITEMS {
        integer id PK
        integer order_id FK
        integer product_id FK
        integer quantity
        numeric unit_price
        text status
    }

    CUSTOMERS ||--o{ ORDERS : "places"
    ORDERS ||--|{ ORDER_ITEMS : "contains"

    %% ==========================================
    %% 2. PRODUCT INTELLIGENCE & INVENTORY
    %% ==========================================
    BRANDS {
        bigint id PK
        text name
    }

    PRODUCTS {
        integer id PK
        text sku
        text name
        bigint brand_id FK
        numeric price
        numeric cost_without_vat
    }

    WAREHOUSES {
        integer id PK
        text name
        text type
        integer partner_id FK
    }

    INVENTORY_LEVELS {
        integer id PK
        integer product_id FK
        integer warehouse_id FK
        integer current_stock
    }

    INVENTORY_LOGS {
        integer id PK
        integer product_id FK
        integer warehouse_id FK
        integer quantity_change
        uuid user_id FK "refs AUTH_USERS"
    }

    PRODUCT_ENTRIES_HISTORY {
        bigint id PK
        bigint product_id FK
        numeric final_cost_with_vat
    }

    LOST_DEMAND {
        integer id PK
        text search_term
        integer product_id FK
    }

    BRANDS ||--o{ PRODUCTS : "categorizes"
    PRODUCTS ||--o{ ORDER_ITEMS : "sold_in"
    PRODUCTS ||--o{ INVENTORY_LEVELS : "tracked_in"
    WAREHOUSES ||--o{ INVENTORY_LEVELS : "stores"
    PRODUCTS ||--o{ INVENTORY_LOGS : "logs_history"
    WAREHOUSES ||--o{ INVENTORY_LOGS : "logs_history"
    PRODUCTS ||--o{ PRODUCT_ENTRIES_HISTORY : "cost_history"
    PRODUCTS ||--o{ LOST_DEMAND : "missed_sales"
    WAREHOUSES ||--o{ ORDERS : "fulfills"

    %% ==========================================
    %% 3. FINANCIAL ENGINE
    %% ==========================================
    ACCOUNTS {
        integer id PK
        text code
        text name
        text category
    }

    TRANSACTIONS {
        integer id PK
        integer order_id FK
        text reference_type
        text description
    }

    TRANSACTION_LINES {
        integer id PK
        integer transaction_id FK
        integer account_id FK
        numeric debit
        numeric credit
    }

    COMMISSION_LEDGER {
        uuid id PK
        uuid sales_user_id FK "refs PROFILES"
        integer order_id FK
        numeric amount
        text status
    }

    POINT_LEDGER {
        uuid id PK
        uuid user_id FK "refs AUTH_USERS"
        integer order_item_id FK
        numeric points
        text milestone
    }

    GLOBAL_POOL {
        uuid id PK
        date month_year
        numeric total_pool_amount
    }

    ORDERS ||--o{ TRANSACTIONS : "generates"
    TRANSACTIONS ||--|{ TRANSACTION_LINES : "contains"
    ACCOUNTS ||--o{ TRANSACTION_LINES : "records_in"
    ACCOUNTS ||--o{ ORDERS : "payment/shipping_acct"
    ORDERS ||--o{ COMMISSION_LEDGER : "yields"
    ORDER_ITEMS ||--o{ POINT_LEDGER : "awards"

    %% ==========================================
    %% 4. ACCESS & SYSTEM CONTROL
    %% ==========================================
    AUTH_USERS {
        uuid id PK "External Auth Schema"
    }

    PROFILES {
        uuid id PK, FK "refs AUTH_USERS"
        text full_name
        integer role_id FK
        text referral_code
    }

    ROLES {
        integer id PK
        text name
        jsonb permissions
    }

    PARTNERS {
        integer id PK
        text name
        text type
    }

    API_KEYS {
        uuid id PK
        text name
        text provider
    }

    SYSTEM_EVENTS {
        uuid id PK
        text event_type
        text status
        jsonb payload
    }

    AUTH_USERS ||--|| PROFILES : "has_profile"
    ROLES ||--o{ PROFILES : "assigned_to"
    PROFILES ||--o{ COMMISSION_LEDGER : "earns"
    AUTH_USERS ||--o{ POINT_LEDGER : "earns"
    AUTH_USERS ||--o{ CUSTOMERS : "claims"
    AUTH_USERS ||--o{ ORDERS : "creates/closes"
    PARTNERS ||--o{ WAREHOUSES : "operates"
    PARTNERS ||--o{ ORDERS : "associated_with"