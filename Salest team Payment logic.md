flowchart TD
    %% Estilos de Nodos
    classDef trigger fill:#1e1e1e,stroke:#fff,color:#fff,font-weight:bold;
    classDef pointAction fill:#e3f2fd,stroke:#1565c0,color:#000;
    classDef condition fill:#fff9c4,stroke:#fbc02d,color:#000,shape:diamond;
    classDef reward fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:2px;
    classDef penalty fill:#ffebee,stroke:#c62828,color:#000;
    classDef monthCycle fill:#f3e5f5,stroke:#7b1fa2,color:#000,stroke-dasharray: 5 5;
    classDef gate fill:#fff3e0,stroke:#ef6c00,stroke-width:3px,color:#000;

    %% --- CARRIL 1: CICLO TEMPORAL ---
    subgraph Temporal ["CICLO MENSUAL (Admin)"]
        direction LR
        MStart(("Día 1: Reset")):::monthCycle --> OpenLedger["Libro de Puntos Abierto"]:::monthCycle
        OpenLedger --> WorkingDays["Días 1-28: Acumulación de Puntos"]:::monthCycle
        WorkingDays --> MEnd(("Día 30/31: Corte y Snapshots")):::monthCycle
    end

    %% --- CARRIL 2: GENERACIÓN DE PUNTOS (OPERACIÓN) ---
    Temporal --> Lane2

    subgraph Lane2 ["FASE DE EJECUCIÓN: Escribiendo en el Point Ledger"]
        direction TB
        NewOrder["Actividad Operativa<br/>(Líneas de Orden)"]:::trigger --> M1
        
        M1["Hito 1: Ventas<br/>(Convertir Proforma)"]:::pointAction --> M2
        M2["Hito 2: Sourcing<br/>(Crear PO)"]:::pointAction --> M2Check{¿Ahorro vs Target?}:::condition
        
        M2Check -- "Sí" --> SourcingBonus["Bono Multiplicador x1.5"]:::reward
        M2Check -- "No" --> SourcingBase["Puntos Base Sourcing"]:::pointAction
        
        SourcingBonus --> M3
        SourcingBase --> M3
        
        M3["Hito 3: Data Steward<br/>(Oficializar SKU)"]:::pointAction --> M4
        M4["Hito 4: Finanzas<br/>(Conciliar Pago Lineal)"]:::pointAction
        
        M4 --> PointsLogged["Registrar Puntos en Ledger<br/>(Estado Inicial: CONGELADO)"]:::penalty
    end

    %% --- CARRIL 3: EL FILTRO DE PAGO Y POOL GLOBAL ---
    PointsLogged --> GateCondition

    subgraph Lane3 ["FASE DE LIQUIDACIÓN: Aportes al Pool"]
        direction TB
        GateCondition{"¿Líneas de Factura<br/>Pagadas y Entregadas?"}:::gate
        
        GateCondition -- "NO (Crédito/Mora)" --> PointsFrozen["Puntos se mantienen<br/>CONGELADOS"]:::penalty
        GateCondition -- "SÍ (Cobro Exitoso)" --> PointsReleased["Puntos cambian a<br/>LIBERADOS"]:::reward
        
        PointsReleased --> LineGP["Aporte de Línea:<br/>10% GP de esta línea"]:::reward
        LineGP --> GlobalPool[("POOL GLOBAL MENSUAL<br/>(Sumatoria $ de todas las líneas pagadas)")]:::trigger
    end

    %% --- CARRIL 4: DESEMBOLSO Y CLAWBACK ---
    GlobalPool --> ValueDistribution
    MEnd -.-> ValueDistribution

    subgraph Lane4 ["PAGO DE NÓMINA & CLAWBACK"]
        direction TB
        ValueDistribution["Calcular Valor del Punto:<br/>(Pool Global $ / Total de Puntos Liberados Globales)"]:::reward
        
        ValueDistribution --> PayoutCalc["Calcular mi nómina:<br/>(Mis Pts Liberados * Valor del Punto)"]:::reward
        PayoutCalc --> MonthlyPayout(("💰 DESEMBOLSO REAL")):::trigger
        
        MonthlyPayout --> ClawbackCheck{"¿Cliente devuelve pieza o<br/>cheque rebota (Mes+1)?"}:::gate
        
        ClawbackCheck -- "Sí" --> NegativePoints["Clawback (Ajuste ERP):<br/>Asentar Puntos Negativos<br/>para la nómina del próximo mes"]:::penalty
    end

    %% Relaciones de actualización
    PointsFrozen -.-> |"Meses después, si el cliente paga..."| PointsReleased