flowchart TD
    %% Estilos
    classDef startEnd fill:#1e1e1e,stroke:#fff,stroke-width:2px,color:#fff;
    classDef sales fill:#e3f2fd,stroke:#1565c0,color:#000;
    classDef sourcing fill:#fff3e0,stroke:#ef6c00,color:#000;
    classDef finance fill:#e8f5e9,stroke:#2e7d32,color:#000;
    classDef inventory fill:#f3e5f5,stroke:#7b1fa2,color:#000;
    classDef decision fill:#fff9c4,stroke:#fbc02d,shape:diamond,color:#000;
    classDef automatic fill:#ffe0b2,stroke:#f57c00,stroke-dasharray: 5 5,color:#000;
    classDef dataAdmin fill:#e0f7fa,stroke:#006064,stroke-width:2px,color:#000;
    classDef blocked fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000;
    
    %% Nudos de Recompensa (Nuevos)
    classDef points fill:#fff9c4,stroke:#f57f17,stroke-width:2px,stroke-dasharray: 5 5,color:#000;
    classDef payout fill:#dcedc8,stroke:#33691e,stroke-width:3px,color:#000;

    Start(("Inicio de Venta")):::startEnd --> CreateQuote

    subgraph Lane1 ["LANE 1: KANBAN DE VENTAS (Front-Office)"]
        direction TB
        CreateQuote["Crear Cotización (Order Header)"]:::sales --> InputItem
        
        InputItem["Vendedor teclea repuesto<br/>(Ej: 'Filtro de aire CB190')"]:::sales --> FuzzySearch
        
        FuzzySearch{"Búsqueda Global<br/>(Catálogo + Drafts + Historial)"}:::decision
        
        FuzzySearch -- "1. En Catálogo" --> SuggestCatalog["Sugerir Producto Oficial"]:::automatic
        SuggestCatalog --> LinkCatalog["Vendedor confirma vínculo"]:::sales
        
        FuzzySearch -- "2. En Draft Activo" --> AttachToDraft["Vincular a Draft Existente<br/>(Aumenta 'Demand Count')"]:::automatic
        
        FuzzySearch -- "3. Historial Rechazado" --> ShowRejection["Bloqueo: Mostrar Motivo"]:::blocked
        ShowRejection --> SalesRenegotiate
        
        FuzzySearch -- "4. No existe" --> CreateDraft["Crear NUEVO 'Prospecto' (Draft)"]:::automatic
        
        LinkCatalog --> AddItems
        AttachToDraft --> AddItems
        CreateDraft --> AddItems
        
        AddItems["Agregar Ítem(s) a Cotización"]:::sales --> SendQuote
        SendQuote["Enviar Proforma"]:::sales --> CustApprove{"¿Cliente Aprueba?"}:::decision
        
        CustApprove -- "No" --> LostOrder["Estado: Perdido"]:::sales
        CustApprove -- "Sí" --> OrderActive["Orden Activa<br/>(Espera a Operaciones)"]:::sales
        
        %% HITO 1: RECOMPENSA DE VENTAS
        OrderActive --> PointSales["🏆 M1: + PUNTOS (Ventas)<br/>(Base por Cerrar + Bono por Draft)"]:::points
        
        SalesRenegotiate["Acción Obligatoria:<br/>Reemplazar o Cancelar Ítem"]:::sales
        SalesRenegotiate -- "Vuelve a buscar" --> InputItem
    end

    PointSales ==> |"Trigger: Desglosa ítems"| SplitItems{"Separar Ítems por Tipo"}:::decision

    subgraph Lane2 ["LANE 2: KANBAN DE OPERACIONES (Back-Office)"]
        direction TB
        
        SplitItems -- "Oficial & En Stock" --> ReadyToShip["Ítems Listos para Asignar"]:::inventory
        SplitItems -- "Draft o Sin Stock" --> SourcingBoard["Kanban de Sourcing<br/>(Ordenado por 'Demand Count')"]:::sourcing
        
        SourcingBoard --> FoundIt{"¿Se encontró Proveedor?"}:::decision
        FoundIt -- "No" --> RejectItem["Mover a Historial Rechazado"]:::sourcing 
        RejectItem -.-> |"Penalidad / Cero Puntos"| SalesRenegotiate
        
        FoundIt -- "Sí" --> SourcingMargin{"¿Costo de Compra<br/>Protegió el Margen?"}:::decision
        
        %% HITO 2: RECOMPENSA DE SOURCING
        SourcingMargin -- "Sí (Ahorro / Barato)" --> SourcingBonus["🏆 M2: + PUNTOS x 1.5 (Sourcing)<br/>(Multiplicador por Ahorro)"]:::points
        SourcingMargin -- "No (Caro pero OK)" --> SourcingBase["🏆 M2: + PUNTOS Base (Sourcing)"]:::points
        
        SourcingBonus --> CheckSpecial{"¿Es Pedido Especial?"}:::decision
        SourcingBase --> CheckSpecial
        
        CheckSpecial -- "Sí" --> RequireDeposit["Cobrar Anticipo"]:::finance
        RequireDeposit --> PO_Creation
        CheckSpecial -- "No" --> PO_Creation["Crear Orden de Compra (PO)"]:::sourcing
        
        PO_Creation --> MasterDataWorkflow["Auditoría Data Steward:<br/>Oficializar SKU en BD"]:::dataAdmin
        
        %% HITO 3: RECOMPENSA DE DATA
        MasterDataWorkflow --> PointData["🏆 M3: + PUNTOS (Data Steward)<br/>Por calidad de Catálogo"]:::points
        
        PointData --> DropshipCheck{"¿Drop-Shipping?"}:::decision
        DropshipCheck -- "Sí" --> Dropship["Envío directo a Cliente"]:::inventory
        DropshipCheck -- "No" --> ReceiveStock["Entrada de Repuestos"]:::inventory
        ReceiveStock --> ReadyToShip
        
        ReadyToShip --> CalcBalance["Calcular Capacidad del Cliente"]:::finance
        Dropship --> CalcBalance
        
        CalcBalance --> HasEnough{"¿Saldo + Crédito cubre?"}:::decision
        
        HasEnough -- "No" --> RequestPayment["Solicitar Pago / Abono"]:::finance
        RequestPayment --> ReceivePayment["Cliente realiza Pago"]:::finance
        ReceivePayment --> RecordPayment["Registrar Transacción (Pasivo)"]:::finance
        
        %% HITO 4: RECOMPENSA DE COBRANZA
        RecordPayment --> PointFinance["🏆 M4: + PUNTOS (Finanzas)<br/>Por asegurar liquidez"]:::points
        PointFinance --> CalcBalance
        
        HasEnough -- "Sí" --> DeductInventory["Descontar Inventario"]:::inventory
    end

    %% --- MODIFICACIONES APLICADAS DESDE AQUÍ ---

    DeductInventory --> ShipItem["Enviar Repuesto(s) Físicamente"]:::inventory
    ShipItem --> IssueInvoice["Emitir Factura<br/>(Por Líneas Entregadas)"]:::finance
    
    IssueInvoice --> LineReconciliation["Conciliación por Líneas<br/>(Ventas - Costos = GP Real)"]:::finance
    
    LineReconciliation --> CheckAll{"¿Faltan ítems<br/>en la Orden?"}:::decision
    CheckAll -- "Sí" --> Partial["Backorder:<br/>Esperar resto de ítems"]:::sales
    Partial -.-> |"Cuando haya stock"| ReadyToShip
    CheckAll -- "No" --> OrderComplete["Orden 100% Completada"]:::sales
    
    LineReconciliation --> LineAllOrNothing{"REGLA ALL-OR-NOTHING:<br/>¿Factura de estas líneas<br/>100% Pagada?"}:::decision
    
    LineAllOrNothing -- "No (Aún en Crédito/Mora)" --> PendingCommission["Estado: Puntos Congelados<br/>Nadie cobra aún"]:::blocked
    
    LineAllOrNothing -- "Sí (Cobro Exitoso)" --> ReleasePoints["Liberar Puntos de los Involucrados"]:::payout
    ReleasePoints --> PoolCalc["Fondo Común<br/>Aporta 10% del GP al Pool Global"]:::payout

    subgraph Lane3 ["LANE 3: LIQUIDACIÓN GLOBAL & CLAWBACK"]
        direction TB
        MonthEnd(("Cierre de Mes<br/>(Día 30/31)")):::startEnd --> GlobalPool["Sumatoria del Pool Global Mensual"]:::payout
        PoolCalc -.-> |"Alimenta"| GlobalPool
        
        GlobalPool --> PayoutDistribution["Cálculo Competitivo:<br/>(Mis Pts Liberados / Pts Totales Globales) * Pastel"]:::payout
        PayoutDistribution --> PayCommissions(("💰 Dispersar Dinero de Nómina")):::startEnd
        
        PayCommissions --> CheckBadDebt{"¿Hubo Devolución o<br/>Incobrable post-pago?"}:::decision
        CheckBadDebt -- "Sí (Clawback)" --> NegativePoints["Ledger: Asentar Puntos Negativos<br/>(Se descuentan al siguiente mes)"]:::blocked
    end