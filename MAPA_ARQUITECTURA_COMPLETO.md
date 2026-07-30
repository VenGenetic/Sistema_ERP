# Mapa de Arquitectura Completo - Sistema ERP

Este documento ilustra la arquitectura integral del sistema ERP, mostrando las capas de Frontend, Backend y Datos, junto con sus interconexiones, estado y esquemas relacionales.

## Diagrama Arquitectónico (Mermaid.js)

```mermaid
graph TD
    %% ==========================================
    %% CAPA FRONTEND
    %% ==========================================
    subgraph FrontEnd_Tier [Capa Frontend - React/Vite TypeScript]
        Router[Router Principal<br/>App.tsx]
        AuthCtx[Contexto de Autenticación<br/>AuthContext.tsx]
        Stores[Gestión de Estado<br/>Zustand: cartStore, usePOEStore]
        
        subgraph Escritorio [Módulos de Escritorio]
            D_Dash[Dashboard & Analytics]
            D_POS[Punto de Venta POS]
            D_Inv[Gestión de Inventario<br/>Inventory, Products, Tags]
            D_Ord[Pedidos y Clientes<br/>Orders, Customers]
            D_Fin[Finanzas y Registro<br/>Finance, Expenses, DailyRegistry]
            D_POE[Módulo Especializado POE]
        end
        
        subgraph Movil [Aplicación Móvil]
            M_Dash[Dashboard Móvil]
            M_Cat[Catálogo Móvil]
            M_Inv[Inventario Móvil]
            M_Lab[Cola de Impresión Labels]
        end
        
        Router -->|Provee Rutas| AuthCtx
        AuthCtx -->|Protege Rutas| Escritorio
        AuthCtx -->|Protege Rutas| Movil
        Escritorio -->|Lee/Escribe Estado| Stores
        Movil -->|Lee/Escribe Estado| Stores
    end

    %% ==========================================
    %% CAPA BACKEND
    %% ==========================================
    subgraph BackEnd_Tier [Capa Backend - Supabase BaaS]
        SB_Client[Cliente Supabase TS<br/>supabaseClient.ts]
        GoTrue[Autenticación<br/>GoTrue Auth]
        PostgREST[API REST de Datos<br/>PostgREST]
        Storage[Almacenamiento S3<br/>Imágenes/Recursos]
        RPC[Funciones Postgres<br/>RPCs/Triggers]
        
        SB_Client --[Login / Sesión]--> GoTrue
        SB_Client --[Operaciones CRUD]--> PostgREST
        SB_Client --[Subida/Descarga Archivos]--> Storage
        SB_Client --[Lógica Compleja BD]--> RPC
    end

    %% ==========================================
    %% CAPA DE DATOS (BASE DE DATOS)
    %% ==========================================
    subgraph Data_Tier [Capa de Datos - PostgreSQL Relacional]
        
        subgraph Seguridad_BD [Auth y Perfiles]
            AuthUsers[(AUTH_USERS<br/>PK: id)]
            Profiles[(PROFILES<br/>PK: id, FK: role_id)]
            Roles[(ROLES<br/>PK: id)]
        end
        
        subgraph Entidades_Negocio [Catálogo y Clientes]
            Products[(PRODUCTS<br/>PK: id, FK: brand_id)]
            Brands[(BRANDS<br/>PK: id)]
            Customers[(CUSTOMERS<br/>PK: id)]
            Warehouses[(WAREHOUSES<br/>PK: id)]
        end
        
        subgraph Transacciones [Pedidos e Inventario]
            Orders[(ORDERS<br/>PK: id, FK: customer, warehouse)]
            OrderItems[(ORDER_ITEMS<br/>PK: id, FK: order, product)]
            InvLevels[(INVENTORY_LEVELS<br/>PK: id, FK: product, warehouse)]
            Transactions[(TRANSACTIONS<br/>PK: id, FK: order_id)]
        end

        %% Relaciones Foráneas y Flujos
        AuthUsers --[FK id 1:1]--> Profiles
        Roles --[FK role_id 1:N]--> Profiles
        
        Brands --[FK brand_id 1:N]--> Products
        Customers --[FK customer_id 1:N]--> Orders
        Warehouses --[FK warehouse_id 1:N]--> Orders
        
        Orders --[FK order_id 1:N]--> OrderItems
        Products --[FK product_id 1:N]--> OrderItems
        
        Products --[FK product_id 1:N]--> InvLevels
        Warehouses --[FK warehouse_id 1:N]--> InvLevels
        
        Orders --[FK order_id 1:N]--> Transactions
    end

    %% ==========================================
    %% INTERCONEXIONES ENTRE CAPAS (TIERS)
    %% ==========================================
    Escritorio --[Llama Funciones TS]--> SB_Client
    Movil --[Llama Funciones TS]--> SB_Client
    Stores --[Llama Funciones TS]--> SB_Client
    
    GoTrue --[Sincroniza y Protege]--> AuthUsers
    PostgREST --[Lee/Escribe Tablas]--> Entidades_Negocio
    PostgREST --[Lee/Escribe Tablas]--> Transacciones
    PostgREST --[Verifica Permisos RLS]--> Seguridad_BD
    RPC --[Ejecuta en Motor DB]--> Data_Tier
```

### Detalles de la Implementación

1. **FrontEnd_Tier**: Refleja tu estructura modular donde el enrutamiento base (`App.tsx`) distribuye a dos dominios principales (Escritorio vs. Móvil). Ambos ecosistemas acceden a estados globales y context providers compartidos (`cartStore`, `usePOEStore`).
2. **BackEnd_Tier**: Utilizas el cliente oficial de Supabase como proxy directo hacia la infraestructura Backend-as-a-Service, separando la lógica de Autenticación, Acceso a Datos y Storage de forma limpia sin necesitar un intermediario Node.js/Express.
3. **Data_Tier**: Refleja las agrupaciones relacionales del esquema en Markdown, enfatizando las Foráneas clave y demostrando cómo la API (PostgREST) fluye directamente a través de las validaciones de Row Level Security (RLS) hacia las tablas.
