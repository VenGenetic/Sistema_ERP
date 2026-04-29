-- Migration: Importación de Nuevos Productos-- Timestamp: 20260429000000
BEGIN;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '10W304TL', 'ACEITE YUKO SEMI SINTETICO 4T 10W30 CAJA X12UND', 'General', 7.2200, 13.6999
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '10W304TL')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '132102-P14A-0000', 'BIELA XCAPE 650', 'General', 80.0000, 151.8000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '132102-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '141001-P14A-0000', 'VALVULA (AD-ES) XCAPE 650', 'General', 36.0000, 68.3100
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '141001-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '141002-P14A-0000', 'KIT VALVULAS ARMADAS (2AD-2ES) SET4 XCAPE 650', 'General', 120.0000, 227.7000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '141002-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '161005-P14A-0000', 'TAPON ACEITE CARTER XCAPE 650', 'General', 2.8000, 5.3130
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '161005-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '162012-P14A-0000', 'FILTRO ACEITE XCAPE 650', 'General', 14.4000, 27.3240
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '162012-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '20W504TL', 'ACEITE YUKO SEMI SINTETICO 20W50 CAJA X12UN', 'General', 6.5600, 12.4476
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '20W504TL')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '222002-P14A-0000', 'PREFILTRO BOMBA GASOLINA XCAPE 650', 'General', 6.4000, 12.1440
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '222002-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '301000-P14A-0000', 'BOBINA BUJIA XCAPE 650', 'General', 52.0000, 98.6700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '301000-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '415000-P14A-0000', 'SENSOR PRESION DE AIRE XCAPE 650', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '415000-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '426100-P14A-0000', 'PASTILLAS FRENO POST SET2 XCAPE 650', 'General', 72.0000, 136.6200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '426100-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '452002-P14A-0000', 'RADIO M45X075 - D40- 197L XCAPE 650CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '452002-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '463100-P14A-0000', 'PASTILLAS FRENO DEL XCAPE 650CC', 'General', 76.0000, 144.2100
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '463100-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '471001-P14A-0000', 'RETEN Y POLVERA TELESCOPICA XCAPE 650', 'General', 44.0000, 83.4900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '471001-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '534004-P14A-0000', 'CAUCHO DESLIZ CADENA XCAPE 650', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '534004-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '81000A-P14A-0000', 'CRASHBAR ARMADO XCAPE 650', 'General', 180.0000, 341.5500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '81000A-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '840000-P14A-0000', 'PROTEC MOTOR XCAPE 650', 'General', 144.0000, 273.2400
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '840000-P14A-0000')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'BASCX7-001', 'BASE ASIENTO CX7 PRO', 'General', 1.0000, 1.8975
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'BASCX7-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'BASTNQ-001', 'BASE ASIENTO TANQ 125', 'General', 0.0000, 0.0000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'BASTNQ-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'BAT003', 'BATERIA GEL 12N7A-3A SHARK 2/MONTANA150/LEOPARD/SHARK 1', 'General', 16.6100, 31.5175
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'BAT003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'BAT004', 'BATERIA CON ACIDO 12N65/YB65 DELTAPANTHER/INDY/WORKFORCE/SCRAMBLER', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'BAT004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'BATE013', 'BATERIA CON ACIDO 12N7A-3A SHARK II/MONTANA 150/LEOPARD', 'General', 13.3900, 25.4075
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'BATE013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'BATE017', 'BATERIA CON ACIDO YB7-A CRUCERO/TEKKEN/SPEED 200/WING EVO/WING EVO 2', 'General', 16.5000, 31.3087
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'BATE017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'BATYU001', 'BATERIA CON ACIDO YUASA 12N9-4B1', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'BATYU001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB110CX79C-001', 'ARBOL LEVAS CB 110CC CX7 110CC', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB110CX79C-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB110CX79C-042.', 'VARILLA FRENO CB 110CC.', 'General', 1.3600, 2.5806
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB110CX79C-042.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB110CX79C-046.', 'TELESCOPICAS (I-D) CX7 ANTIGUA 110CC GRIS.', 'General', 31.9200, 60.5682
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB110CX79C-046.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB110CX79C-094.', 'CARTER IZQ. CB110CC.', 'General', 26.8400, 50.9289
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB110CX79C-094.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB110CX79C-122', 'PROTEC SWITCH CX-7 EVO/DK125- 10/RANGER 125FY', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB110CX79C-122')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB110CX79C-128', 'PLACA LAT (I-D) NEGRAS CX7EVO/DK125- 10/RANGER 125FY', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB110CX79C-128')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB110CX79C-148A', 'PLACA LAT POST (I-D) CX7EVO/DK125- 10/RANGER 125FY BLANCO-AZUL', 'General', 17.9900, 34.1360
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB110CX79C-148A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB110CX79C-148R', 'PLACA LAT POST (I-D) CX7EVO/DK125- 10/RANGER 125FY BLANCO-NARANJA', 'General', 17.9900, 34.1360
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB110CX79C-148R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125-9C-004', 'BALANCINES SET2 CB125 CX7 EVO/TANQUE 125CC CABALLITO', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125-9C-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-001', 'ARBOL LEVAS BIT 125CC', 'General', 12.8400, 24.3639
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-002D', 'ARO DEL MAGNECIO 275X12 DISCO 3H BIT 125CC DORADO', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-002D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-002G', 'ARO DEL MAGNECIO 275X12 DISCO 3H BIT 125CC GRIS', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-002G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-007', 'BENDIX ARMADO BIT 125CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-008', 'BOBINA CORONILLA 12M/3H BIT 125CC', 'General', 15.1600, 28.7661
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-012', 'CABLE ACELERADOR BIT 125CC', 'General', 2.5200, 4.7817
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-012')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-013', 'CABLE FRENO POST BIT 125CC', 'General', 2.7800, 5.2750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-014', 'CADENILLA 2X3 90E BIT 125CC', 'General', 7.7000, 14.6107
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-019', 'CDI 6PIN REDONDO BIT 125CC', 'General', 9.8600, 18.7093
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-022', 'DEPURADOR AIRE BIT 125CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-023', 'DIRECCIONALES (SET4) BIT 125CC', 'General', 12.8400, 24.3639
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-028', 'ESTRIBO DEL-POST CON BASE (I-D) BIT 125CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-031', 'FLASH 3PIN SOCKET BIT 125CC', 'General', 3.8000, 7.2105
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-032D', 'GUARDAFANGO DEL BIT 125CC N-DORADO', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-032D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-032V', 'GUARDAFANGO DEL BIT 125CC N-VERDE', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-032V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-033', 'GUARDAFANGO POST INFERIOR BIT 125CC', 'General', 5.1400, 9.7531
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-033')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-034', 'GUIA CADENILLA (1-2) BIT 125CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-034')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-036', 'KIT EMBRAGUE SET2 BIT 125CC', 'General', 46.2200, 87.7024
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-045D', 'MASCARILLA COMP BIT 125CC N-DORADO', 'General', 35.1000, 66.6022
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-045D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-045V', 'MASCARILLA COMP BIT 125CC N-VERDE', 'General', 35.1000, 66.6022
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-045V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-046', 'MESA DIRECCION ARMADA BIT 125CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-051', 'PATA APOYO LATERAL BIT 125CC', 'General', 3.0400, 5.7684
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-051')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-052', 'PINON VELOCIMETRO DIGITAL BIT 125CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-053D', 'PLACA LAT POST (I-D) BIT 125CC N-DORADO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-053D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-054D', 'PLACA TANQUE (I-D) BIT 125CC N-DORADO SET16', 'General', 75.0000, 142.3125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-054D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-054V', 'PLACA TANQUE (I-D) BIT 125CC N-VERDE SET16', 'General', 75.0000, 142.3125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-054V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-055', 'PORTA PLACAS BIT 125CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-055')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-056', 'PROTEC ESCAPE BIT 125CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-056')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-059', 'RECTIFICADOR CORRIENTE 5 PIN BIT 125CC', 'General', 6.5800, 12.4855
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-059')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-060', 'SENSOR PATA APOYO BIT 125CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-060')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-064', 'TAPA MOTOR IZQ DAYTONA BIT 125CC', 'General', 30.8200, 58.4809
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-064')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-065', 'TELESCOPICAS (I-D) BIT 125CC GRIS', 'General', 75.0000, 142.3125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-065')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-067', 'TIMON BIT 125', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-067')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125BIT-069', 'VELOCIMETRO DIGITAL BIT 125CC', 'General', 38.8800, 73.7748
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125BIT-069')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-001', 'RECTIFICADOR CORRIENTE 4 PIN CX7 EVO', 'General', 3.8600, 7.3243
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-001CL', 'CILINDRO Y PISTON 120CC 52MM/PIN13 CB125 CX7 EVO/TANQ 125CC CABALLITO GRIS', 'General', 24.4400, 46.3749
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-001CL')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-002', 'BOBINA CORONILLA 8M/2H CB125 CX7 EVO/TANQ 125CC CABALLITO', 'General', 11.2600, 21.3658
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-003', 'CAJA CAMBIOS ARMADA LEM114MM/LEP123MM SEGURO CB125 CX7 EVO/TANQ 125CC CABALLITO', 'General', 15.6000, 29.6010
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-004', 'ARBOL LEVAS 32T CB125 CX7 EVO/TANQUE 125CC CABALLITO', 'General', 8.2700, 15.6923
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-005.', 'DISCO FRENO DEL. CX7 EVO/CABALLITO UNIVERSAL', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-005.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-006', 'BOMBA ACEITE 24T CB125 CB125 CX7 EVO/TANQ 125CC CABALLITO', 'General', 7.2800, 13.8138
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-010', 'EJE PEDAL ARRANQUE 120MM CB125 CX7 EVO/TANQ 125CC CABALLITO', 'General', 10.4000, 19.7340
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-011', 'CADENILLA 25H 90L CB125 CX7 EVO/TANQUE 125CC CABALLITO', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-012', 'BASE CARBURADOR ALUMINIO CB125 CX7 EVO', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-012')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-014', 'KIT PINONES ARRANQUE 41T/17T CB125 CX7 EVO CABALLITO UNIVERSAL', 'General', 10.4000, 19.7340
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-015', 'MOTOR ARRANQUE 12D CB125 CX7 EVO/TANQ 125CC CABALLITO', 'General', 18.2000, 34.5345
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-016', 'VALVULA (AD23mm-ES20mm) PICO LARGO CB125 CX7 EVO/TANQ 125CC CABALLITO', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-019', 'TENSOR ARRANQUE CB125 CX7 EVO/TANQUE 125CC CABALLITO', 'General', 2.6000, 4.9335
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-021', 'CADENILLA BOMBA ACEITE 25H 62L CB125 CX7 EVO/TANQ 125CC CABALLITO', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-022', 'KIT EMPAQUES CB125 CX7 EVO/TANQUE 125CC CABALLITO', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-025', 'CABEZOTE COMP CB125 CX7 EVO CABALLITO', 'General', 36.3500, 68.9741
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-026', 'TELESCOPICAS (I-D) CX7 EVO 125CC NEGRO', 'General', 46.8000, 88.8030
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-032', 'PINON VELOCIMETRO EJE 12MM CX7 EVO', 'General', 4.8800, 9.2598
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-036', 'DIRECCIONALES DEL CX7 EVO/DK125- 10/RANGER 125FY', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-037', 'FARO CX7 EVO/DK125-10/RANGER 125FY', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-037')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125CX7-041', 'STOP CX7 EVO/DK125-10/RANGER 125FY', 'General', 11.9600, 22.6941
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125CX7-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-002V', 'PLACA LAT POST (I-D) TANQ 125CC N-VERDE', 'General', 24.0000, 45.5400
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-002V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-003R', 'MASCARILLA INFERIOR TANQ 125CC N-ROJO', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-003R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-004', 'DIRECCIONALES DEL (I-D) TANQ 125CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-005', 'STOP TANQ 125CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-006', 'FARO TANQ 125CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-011', 'PORTA PLACAS TANQ 125CC', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-016', 'PARRILLA POST COMPLETA TANQ 125CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-019', 'CUBRE MANOS TANQ 125CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-022', 'AMORTIGUADOR (I-D) 3305MM TANQ CB125CC N-CROMADO', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-023R', 'PLACA LATERAL DEL TANQ 125CC N-ROJO', 'General', 24.0000, 45.5400
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-023R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-028', 'VELOCIMETRO TANQ 125CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-029', 'CABLE ACELEREADOR TANQ 125CC', 'General', 1.0000, 1.8975
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-030', 'CABLE VELOCIMETRO TANQ 125CC', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-033', 'CAUCHO DESLIZ CADENA TANQ 125CC', 'General', 0.9200, 1.7457
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-033')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-034', 'KIT PISTAS DIRECCION TANQ 125CC', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-034')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-043', 'BOYA GASOLINA TANQ 125CC', 'General', 2.2800, 4.3263
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-043')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-044', 'CABLE AHOGADOR TANQ 125CC', 'General', 1.0000, 1.8975
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-044')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-048', 'MESA DIRECCION ARMADA TANQ 125CC', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB125TNQ-052', 'CDI 5 PIN CUADRADO TANQ 125CC', 'General', 4.5000, 8.5387
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB125TNQ-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-028N', 'GUARDAFANGO DEL MONTANA 150/EAGLE 3-5 150CC NEGRO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-028N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-028R', 'GUARDAFANGO DEL MONTANA 150/EAGLE 3-5 150CC ROJO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-028R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-028T', 'GUARDAFANGO DEL MONTANA 150/EAGLE 3-5 150CC NARANJA', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-028T')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-030N', 'PLACA TANQUE (I-D) MONTANA 150CC N-VERDE', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-030N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-030R', 'PLACA TANQUE (I-D) MONTANA 150CC N-ROJO', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-030R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-030T', 'PLACA TANQUE (I-D) MONTANA 150CC N- NARANJA', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-030T')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-036', 'MESA DIRECCION ARMADA MONTANA 150CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-048', 'PARRILLA MONTANA 150CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-054', 'TELESCOPICAS (I-D) MONTANA 150CC NEGRO', 'General', 75.0000, 142.3125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-054')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-059', 'CAUCHO DESLIZ CADENA MONTANA 150', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-059')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-060.', 'PEDAL CAMBIOS MONTANA 150.', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-060.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150-071', 'ASIENTO MONTANA 150CC', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150-071')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-001', 'ASIENTO BONEVILLE 150CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-003', 'FARO BONEVILLE 150', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-004', 'STOP BONEVILLE 150', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-005', 'DIRECCIONALES POST BONEVILLE 150', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-006', 'DIRECCIONALES DEL BONEVILLE 150', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-012C', 'PROTEC CHASIS SWITCH BONEVILLE 150 CREMA', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-012C')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-014C', 'PLACA LAT POST INF LARGA (I-D) BONEVILLE 150 CREMA', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-014C')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-017C', 'MASCARILLA FARO Y VELOC BONEVILLE 150 CREMA', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-017C')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-018C', 'PLACA LAT POST (I-D) BONEVILLE 150 CREMA', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-018C')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150BON-021', 'LUZ LED MASCARILLA BONEVILLE 150', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150BON-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-005', 'FILTRO AIRE DYNAMIC PRO/SHM JEDI 150CC', 'General', 3.2000, 6.0720
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-011', 'PROTEC CHASIS INFERIOR DYNAMIC PRO/SHM JEDI 150CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-014', 'PATA APOYO LAT 225MM DYNAMIC PRO/SHM JEDI 150CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-015', 'PINON VELOCIMETRO EJE 10MM DYNAMIC PRO/SHM JEDI 150CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-017', 'VELOCIMETRO DYNAMIC PRO/SHM JEDI 150CC', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-023', 'PORTA PLACAS DYNAMIC PRO/SHM JEDI 150CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-025', 'TIMON DYNAMIC PRO/SHM JEDI 150CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-026', 'MESA DIRECCION ARMADA DYNAMIC PRO/SHM JEDI 150CC', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-030', 'TELESCOPICAS (I-D) DYNAMIC PRO/SHM JEDI 150CC NEGRO', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-032', 'CABLE ACELERADOR DYNAMIC PRO/SHM JEDI 150CC', 'General', 2.5600, 4.8576
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-033', 'CABLE FRENO POST DYNAMIC PRO/SHM JEDI 150CC', 'General', 2.5600, 4.8576
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-033')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-041G', 'PROTEC CHASIS DEL DYNAMIC PRO/SHM JEDI 150CC GRIS', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-041G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-044', 'FOCO LED REDONDO DIRECCIONAL Y STOP SET2 DYNAMIC PRO/SHM JEDI 150CC', 'General', 3.1400, 5.9581
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-044')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-045G', 'GUARDAFANGO DEL DYNAMIC PRO/SHM JEDI 150CC GRIS', 'General', 13.0000, 24.6675
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-045G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-045N', 'GUARDAFANGO DEL DYNAMIC PRO/SHM JEDI 150CC NEGRO', 'General', 13.0000, 24.6675
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-045N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-046', 'CABLE SEGURO ASIENTO DYNAMIC PRO/SHM JEDI 150CC', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-049', 'TAPA MOTOR IZQ DAYTONA DYNAMIC PRO/SHM JEDI 150CC', 'General', 28.7400, 54.5341
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-050', 'CARTER IZQ DYNAMIC PRO/SHM JEDI 150CC', 'General', 38.5200, 73.0917
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-050')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-051', 'CIGUENAL ARMADO DYNAMIC PRO/SHM JEDI 150CC/EIVISA', 'General', 32.7000, 62.0482
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-051')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-052', 'CAJA CAMBIOS ARMADA DYNAMIC PRO/SHM JEDI 150CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150DYP-055', 'EMBLEMA DAYTONA (I-D) DYNAMIC PRO 150CC', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150DYP-055')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-002', 'PROTEC CHASIS INFERIOR EIVISSA', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-003', 'APOYA PIES EIVISSA', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-007B', 'MASCARILLA FARO Y VELOC EIVISSA BLANCO', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-007B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-007G', 'MASCARILLA FARO Y VELOC EIVISSA GRIS', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-007G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-008', 'MASCARILLA VELOCIMETRO EIVISSA NEGRO MATE', 'General', 11.0000, 20.8725
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-010G', 'PROTEC CHASIS SWITCH EIVISSA GRIS', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-010G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-015B', 'GUARDAFANGO DEL EIVISSA BLANCO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-015B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-015G', 'GUARDAFANGO DEL EIVISSA GRIS', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-015G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-021G', 'GUARDAFANGO POST EIVISSA GRIS', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-021G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-022', 'KIT BICELES NEGRO EIVISSA', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-025', 'MANIGUETA FRENO POST CON BASE EIVISSA NEGRO', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-027', 'ESPEJOS (I-D) EIVISSA', 'General', 8.5000, 16.1287
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-029', 'MANUBRIOS (I-D) EIVISSA/BONEVILLE 150CC/AXXO MILANO 150CC', 'General', 4.5000, 8.5387
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-031', 'KIT RUN Y LUCES EIVISSA 150CC', 'General', 9.5000, 18.0262
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-034', 'TELESCOPICAS (I-D) EIVISSA 150CC NEGRO', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-034')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-035', 'ARO DEL MAGNECIO 275X12 DISCO 3H EIVISSA/AXXO MILANO 150CC NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-037', 'ARO POST MAGNECIO 275X12 ZAPATA EIVISSA/AXXO MILANO NEGRO', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-037')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-040', 'ESCAPE COMP EIVISSA', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-040')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-041', 'PROTEC ESCAPE EIVISSA 150CC', 'General', 9.0000, 17.0775
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-042', 'AMORTIGUADOR POST 3305MM EIVISSA /BONEVILLE/MILANO 150CC N-CROMADO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-042')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-043', 'INSTALACION ELECTRICA EIVISSA 150CC', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-043')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-047', 'FARO EIVISSA 150CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-047')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-048', 'PINON VELOCIMETRO DIGITAL EJE 12MM/3PIN EIVISSA/AXXO MILANO 150CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-050', 'STOP EIVISSA 150CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-050')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-051', 'DIRECCIONALES DEL EIVISSA 150CC', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-051')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-052', 'DIRECCIONALES POST EIVISSA 150CC', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-053', 'PORTA PLACAS EIVISSA 150CC', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-053')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-058', 'BOMBA GASOLINA EIVISSA/S1 150CC/S1ADV/EVO2/AGILITY 180CC SCOOTER', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-058')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-064', 'TAPA GASOLINA S1/EIVISSA/DYNAMIC PRO/EVO2/AGILITY/S1 ADVENTURE 180CC', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-064')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-066', 'MANIGUETA FRENO DEL EIVISSA 150CC NEGRO', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-066')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-072', 'EJE DEL EIVISSA/S1 150CC', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-072')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-073B', 'PLACA LAT POST (I-D) EIVISSA BLANCO', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-073B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-073G', 'PLACA LAT POST (I-D) EIVISSA GRIS', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-073G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-073NB', 'PLACA LAT POST (I-D) EIVISSA NEGRO BRILLANTE', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-073NB')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-073NM', 'PLACA LAT POST (I-D) EIVISSA NEGRO MATE', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-073NM')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-074B', 'TAPA DE GUANTERA BLANCO EIVISSA 150', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-074B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-074NB', 'TAPA DE GUANTERA NEGRO BRILLANTE EIVISSA 150', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-074NB')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-074NM', 'TAPA DE GUANTERA NEGRO MATE EIVISSA 150', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-074NM')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-075B', 'PLACA LAT POST INF LARGA (I-D) EIVISSA 150 BLANCO', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-075B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-075G', 'PLACA LAT POST INF LARGA (I-D) EIVISSA 150 GRIS', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-075G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150EIV-075NM', 'PLACA LAT POST INF LARGA (I-D) EIVISSA 150 NEGRO MATE', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150EIV-075NM')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-003', 'BOMBA ACEITE GH/S1 150/180/DYNAMIC PRO/SHM JEDI 150CC/HUNTER 200CC/EIVISA', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-004', 'CABEZOTE ARMADO CB150 GY6 GH/S1/DYNAMIC PRO/SHM JEDI 150CC/EIVISA', 'General', 28.2500, 53.6044
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-008', 'ARBOL LEVAS GH/S1/DYNAMIC PRO/SHM JEDI 150CC', 'General', 14.0000, 26.5650
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-009.', 'EJE TRANSMISION GH/S1 150.', 'General', 5.8400, 11.0814
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-009.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-016', 'PEDAL ARRANQUE GH/S1/DYNAMIC PRO/SHM JEDI 150CC', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-027', 'FARO S1 150/180CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-029', 'KIT RUN Y LUCES S1 150CC/S1 ADVENTURE 180CC', 'General', 10.2700, 19.4873
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-049', 'PATA APOYO LAT GH/S1 150/S1 180CC', 'General', 4.1000, 7.7797
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-050', 'BASE INTERNA MET GHOST', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-050')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-065', 'GUARDAFANGO DEL S1 150/180cc NEGRO', 'General', 11.2000, 21.2520
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-065')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-202B', 'PLACA LAT POST (I-D) S1 150 2022 BLANCO', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-202B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-202N', 'PLACA LAT POST (I-D) S1 150 2024 N-VERDE', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-202N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-202R', 'PLACA LAT POST (I-D) S1 150 2022 ROJO', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-202R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-203', 'EJE DEL S1 150/180', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-203')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-205', 'GUIA CADENILLA (1-2) S1/DYNAMIC PRO/SHM JEDI 150CC/EIVISA', 'General', 3.9800, 7.5520
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-205')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-207', 'KIT BALANCIN ARMADO S1/DYNAMIC PRO/SHM JEDI 150CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-207')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-217', 'PORTA PLACAS S1 150/180', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-217')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-218', 'BOBINA BUJIA S1 150CC/UNIVERSAL SCOOTER 150/180CC', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-218')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-239', 'BOBINA CORONILLA 11M/2H S1 180/EIVISSA/S1ADV/AGILITY/S1 150 2025', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-239')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-245', 'PROTEC ESCAPE S1 150/180/BULTACO FREEDOM/EVO-2 180CC', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-245')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-257', 'CABLE FRENO POST S1 150CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-257')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-274', 'TELESCOPICAS (I-D) S1 150/180/EVO2 180CC NEGRO', 'General', 42.0000, 79.6950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-274')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-275', 'AMORTIGUADOR (I-D) SCOOTER EVO2/S1/JOY/DK150B/POWERMAX 335MM ROJO', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-275')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-278', 'FILTRO AIRE S1 150/180CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-278')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-280', 'KIT EMBRAGUE ARMADO S1/DYNAMIC PRO/SHM JEDI 150/HUNTER 200CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-280')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-284', 'VELOCIMETRO DIGITAL S1 150/180', 'General', 32.0000, 60.7200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-284')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-288', 'DIRECCIONALES LED (SET4) EVO2/S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-288')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150GHS1-290', 'CARTER DER S1/EIVISSA/DYNAMIC PRO/SHM JEDI 150CC', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150GHS1-290')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-005', 'GUARDAFANGO POST INFERIOR EVO2 180/S1 150 2024', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-012', 'ASIENTO S1 150 2025', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-012')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-014', 'STOP S1 150 2025', 'General', 20.4000, 38.7090
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-015', 'DIRECCIONALES DEL SET2 (I-D) S1 150 2025', 'General', 8.7400, 16.5842
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-016', 'DIRECCIONALES POST SET2 (I-D) S1 150 2025', 'General', 10.4800, 19.8858
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-017N', 'PLACA LATERAL (I-D) S1 150 2025 NEGRO-V', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-017N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-017R', 'PLACA LATERAL (I-D) S1 150 2025 G-ROJO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-017R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-017V', 'PLACA LATERAL (I-D) S1 150 2025 G-VERDE', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-017V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-018', 'TAPA VIN S1 150 2025', 'General', 0.6000, 1.1385
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-018')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-020', 'APOYA PIES S1 150 2025', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-021', 'PROTEC CHASIS INFERIOR S1 150 2025', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-022', 'PARABRISAS S1 150 2025', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-023N', 'MASCARILLA COMP S1 150 2025 N-VERDE', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-023N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-023V', 'MASCARILLA COMP S1 150 2025 G-VERDE', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-023V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-024', 'PORTA PLACAS S1 150 2025', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-027R', 'GUARDAFANGO DEL S1 150 2025 N-ROJO', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-027R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-027V', 'GUARDAFANGO DEL S1 150 2025 N-VERDE', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-027V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB150S1-030', 'EMPAQUE TAPA CABEZOTE HUNTER 200/S1 150CC', 'General', 0.8000, 1.5180
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB150S1-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180-019', 'CADENILLA 2X3 94L MOTOR CB180 GY6 S1ADV/AGILITY/EVO2/S1ADV CROSSOVER/AGILITY X 180CC/HUNTER 200CC', 'General', 7.0000, 13.2825
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADV-001', 'APOYA PIES S1 180 ADVENTURE', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADV-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-003', 'ARO DEL MAGNECIO 300X13 DISCO 3H S1 ADV CROSSOVER 180CC', 'General', 48.0000, 91.0800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-007', 'CABLE FRENO POST S1 ADV CROSSOVER 180CC', 'General', 3.0800, 5.8443
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-008', 'CABLE SEGURO ASIENTO S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-014', 'ESPEJOS (I-D) S1 ADV CROSSOVER 180CC', 'General', 11.1200, 21.1002
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-015', 'EXPLORADORAS BUO (I-D) S1 ADV CROSSOVER 180CC', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-016', 'FARO LED S1 ADV CROSSOVER 180CC', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-023C', 'MASCARILLA COMP S1 ADV CROSSOVER 180CC CAFE', 'General', 38.0000, 72.1050
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-023C')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-028A', 'PLACA LAT POST (I-D) S1 ADV CROSSOVER 180CC AZUL', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-028A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-028C', 'PLACA LAT POST (I-D) S1 ADV CROSSOVER 180CC CAFE', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-028C')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-029C', 'PLACA LAT DEL (I-D) S1 ADV CROSSOVER 180CC CAFE', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-029C')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-029V', 'PLACA LAT DEL (I-D) S1 ADV CROSSOVER 180CC G-VERDE', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-029V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-030', 'PORTA PLACAS S1 ADV CROSSOVER 180CC', 'General', 17.0000, 32.2575
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-032', 'PROTEC CHASIS SWITCH S1 ADV CROSSOVER 180CC', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180ADVCR-036', 'TELESCOPICAS (I-D) S1 ADV CROSSOVER 180CC', 'General', 52.0000, 98.6700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180ADVCR-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-001', 'GUARDAFANGO DEL AGILITY 180CC 2019/20/21/2022', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-003', 'APOYA PIES AGILITY 180CC 2019/20/21/2022', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-008', 'MASCARILLA SUPERIOR TIMON VELOCIMETRO SET2 AGILITY 180CC 2019/20/21/2022', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-009', 'TELESCOPICAS (I-D) AGILITY 180CC 2019/20/21/2022 NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-011', 'STOP AGILITY 180CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-013', 'FARO AGILITY 180CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-016', 'PROTEC CHASIS INFERIOR AGILITY 180CC', 'General', 17.0000, 32.2575
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-018', 'MESA DIRECCION ARMADA AGILITY 180CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-018')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-019', 'ARO DEL MAGNECIO 300X14 DISCO 5H AGILITY 180CC NEGRO', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-023', 'OSCILANTE AGILITY 180CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-025', 'DISCO FRENO DEL AGILITY 180CC', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-026', 'VELOCIMETRO AGILITY', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-040V', 'MASCARILLA COMP AGILITY N-VERDE', 'General', 42.0000, 79.6950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-040V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-041', 'TAPA MOTOR IZQ DAYTONA AGILITY 180CC/S1 150 2024', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGTY-045', 'PARRILLA POST AGILITY 180cc', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGTY-045')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-001', 'PORTA PLACAS AGILITY X 180CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-003', 'APOYA PIES AGILITY X 180CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-004', 'PROTEC CHASIS SWITCH AGILITY X 180CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-006', 'STOP AGILITY X 180CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-007', 'FARO SET2 AGILITY X 180CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-008', 'DIRECCIONALES DEL (I-D) AGILITY X 180CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-010', 'ESTRIBO POST CON BASE (I-D) AGILITY X 180CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-021', 'TELESCOPICAS (I-D) AGILITY X 180CC NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-023', 'PUERTO CARGA AGILITY X 180CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-030', 'MANIGUETAS FRENO DEL-POST (I-D) AGILITY X 180CC', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-031', 'BOMBA FRENO DEL (I-D) AGILITY X 180CC', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-032', 'MORDAZA FRENO DEL AGILITY X 180CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-036D', 'PLACA LAT POST (I-D) AGILITY X 180CC N- DORADO', 'General', 32.0000, 60.7200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-036D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-036R', 'PLACA LAT POST (I-D) AGILITY X 180CC G- ROJO', 'General', 32.0000, 60.7200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-036R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-036V', 'PLACA LAT POST (I-D) AGILITY X 180CC G- VERDE', 'General', 32.0000, 60.7200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-036V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-037D', 'MASCARILLA COMP AGILITY X 180CC N- DORADO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-037D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-039D', 'PLACA LATERAL DEL (I-D) AGILITY X 180CC N- DORADO', 'General', 24.0000, 45.5400
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-039D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-039R', 'PLACA LATERAL DEL (I-D) AGILITY X 180CC G- ROJO', 'General', 24.0000, 45.5400
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-039R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-039V', 'PLACA LATERAL DEL (I-D) AGILITY X 180CC G- VERDE', 'General', 24.0000, 45.5400
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-039V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-040D', 'MASCARILLA VELOCIMETRO SET2 AGILITY X 180CC N-DORADO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-040D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-040R', 'MASCARILLA VELOCIMETRO SET2 AGILITY X 180CC G-ROJO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-040R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-040V', 'MASCARILLA VELOCIMETRO SET2 AGILITY X 180CC G-VERDE', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-040V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180AGX-041', 'GUARDAFANGO DEL AGILITY X 180CC NEGRO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180AGX-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-002', 'FARO EVO 2 180CC/RANGER 150BWSM/BULTACO STORM 175CC', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-003', 'PROTEC CHASIS SWITCH EVO 2 180CC/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-007', 'PROTEC CHASIS INFERIOR EVO 2 180CC/RANGER 150BWSM/BULTACO STORM 175CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-008', 'GUARDAFANGO DEL EVO 2 180CC/AXXO VIPER/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-010B', 'PLACA LAT POST (I-D) EVO 2 180CC/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC BLANCO', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-010B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-010T', 'PLACA LAT POST (I-D) EVO 2 180CC/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC NARANJA', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-010T')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-011T', 'CUBRE MANOS (I-D) EVO 2 180CC/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC NARANJA', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-011T')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-021', 'ASIENTO EVO 2 180CC/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-023', 'KIT FRENO DEL ARMADO EVO 2 180CC/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-024', 'MANIGUETA FRENO DEL EVO 2 180CC/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC NEGRO', 'General', 2.0000, 3.7950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180EVO2-026', 'EJE DELANTERO EVO 2 180CC/RANGER 150BWSM/BULTACO STORM/Z1 SUPER 175/SUKIDA JOY 175CC', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180EVO2-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180GHS1-024', 'STOP 180EVO 2', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180GHS1-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-001', 'PATA APOYO CENTRAL S1 ADVENTURE 180CC/IGM SNAKE/RANG TANK/AXXO VIPER 180CC 2024', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-003', 'VELOCIMETRO DIGITAL S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 42.0000, 79.6950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-006G', 'MASCARILLA COMP S1 ADVENTURE 180CC GRIS', 'General', 31.2000, 59.2020
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-006G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-007', 'TELESCOPICAS (I-D) S1 ADVENTURE 180CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-008', 'CUBRE MANOS CON BASE (I-D) S1 ADVENTURE/S1 CROSSOVER 180CC/SHM XPLORE 180CC', 'General', 13.0000, 24.6675
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-009', 'KIT FRENO DEL ARMADO S1 ADVENTURE/SH XPLORER 180CC', 'General', 20.8000, 39.4680
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-011', 'DISCO FRENO DEL S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 9.8500, 18.6904
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-013', 'GUARDAFANGO DEL S1 ADVENTURE 180CC NEGRO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-013G', 'GUARDAFANGO DEL S1 ADVENTURE 180CC GRIS', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-013G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-016', 'PORTA PLACAS S1ADV180', 'General', 17.4500, 33.1114
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-019', 'ESPEJOS (I-D) S1 ADVENTURE 180CC', 'General', 4.5000, 8.5387
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-020', 'ESTRIBOS POST (I-D) S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 8.5500, 16.2236
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-021A', 'PLACA LAT POST (I-D) S1 ADV180 AMARILLO', 'General', 28.6000, 54.2685
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-021A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-024', 'SENSOR VELOCIMETRO S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-025', 'BASE MOTOR S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 18.2000, 34.5345
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-026', 'TIMON S1 ADVENTURE 180CC NEGRO', 'General', 7.8000, 14.8005
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-027', 'MESA DIRECCION ARMADA S1 ADVENTURE 180CC', 'General', 42.0000, 79.6950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-028', 'BOYA GASOLINA S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 3.0900, 5.8633
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-030', 'DEPURADOR AIRE S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 19.9500, 37.8551
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-031', 'FILTRO AIRE S1 ADVENTURE 180CC', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-035', 'RUEDA FONICA S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-036', 'PATA APOYO LAT 265MM S1 ADVENTURE 180CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-039', 'ARO DEL MAGNECIO S1 ADVENTURE 180CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-039')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-041', 'CABLE ACELERADOR S1 ADVENTURE 180CC/S1 150', 'General', 2.5400, 4.8196
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-043', 'CRASHBARS DEL SET3 S1 ADVENTURE 180CC', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-043')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-045', 'RODAMIENTO 6300 (SET2) ARO DEL POST EJE10MM S1 ADV/DYNAMIC PRO', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-045')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-046', 'FARO LED S1 ADVENTURE 180CC', 'General', 46.8000, 88.8030
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-048', 'LUZ PLACA S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 2.1000, 3.9848
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-049', 'PROTEC TELESCOPICAS (I-D) S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 4.5000, 8.5387
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-050', 'PROTEC CHASIS SWITCH S1 ADVENTURE 180CC 2026', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-050')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-052', 'MANUBRIOS Y PESAS (I-D) S1 ADVENTURE 180CC 2026', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-053', 'PROTEC. CHASIS INFERIOR S1 ADVENTIRE 180CC 2026', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-053')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-054', 'PLACA LAT DEL (I-D) S1 ADVENTURE 180CC 2026 (CON PARLANTES)', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-054')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-056', 'ARO POST MAGNECIO 300X12 DISCO S1 ADVENTURE 180CC NEGRO', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-056')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-057', 'PUERTO CARGA USB S1 ADVENTURE 180CC 2026', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-057')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-058', 'ESCAPE COMP S1 ADVENTURE 180CC 2026', 'General', 42.0000, 79.6950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-058')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-062', 'RECTIFICADOR CORRIENTE 5 PIN S1 ADVENTURE 180CC 2026', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-062')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-063', 'GUARDAFANGO POST INFERIOR S1 ADVENTURE 180CC 2026', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-063')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-066', 'AMORTIGUADOR (I-D) S1 ADVENTURE 180CC NEGRO', 'General', 23.0000, 43.6425
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-066')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB180S1ADV-067', 'PARABRISAS Y BASE S1 ADVENTURE/S1 CROSSOVER 180CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB180S1ADV-067')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200-060', 'APOYA MANOS (I-D) SHARK III 200CC (HONGLI)', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200-060')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200ADV-001', 'VELOCIMETRO DIGITAL ADVE 200', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200ADV-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200ADV-016', 'TELESCOPICAS (I-D) ADVENTURE 200 NEGRO', 'General', 120.0000, 227.7000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200ADV-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200ADV-020', 'INSTALACION ELECTRICA ADVENTURE 200', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200ADV-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200ADV-038', 'ARBOL LEVAS 32T ADVE 200CC', 'General', 18.4500, 35.0089
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200ADV-038')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200ADV-062', 'PARABRISAS ARMADO ADVENTURE 200CC/300CC', 'General', 23.0000, 43.6425
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200ADV-062')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200ADV-063', 'GUARDALODO LLANTAS POST ADVENTURE 200', 'General', 15.3300, 29.0887
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200ADV-063')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200ADV-064', 'ARO POST MAGNECIO 375X17 DISCO 4H ADV 200/RANGER 250FY NEGRO', 'General', 60.0000, 113.8500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200ADV-064')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200ADV-068', 'PEDAL FRENO ADVENTURE 200', 'General', 11.7300, 22.2577
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200ADV-068')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-008', 'ARO DEL ARMADO 160X21 4H EAGLE Z 200 NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-009', 'KIT FRENO DEL ARMADO EAGLE Z 200', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-010', 'TELESCOPICAS (I-D) EAGLE Z 200', 'General', 90.0000, 170.7750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-011', 'MESA DIRECCION ARMADA EAGLE Z 200', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-012G', 'MASCARILLA COMP EAGLE Z 200 G-VERDE', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-012G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-012N', 'MASCARILLA COMP EAGLE Z 200 N-NARANJA', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-012N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-012V', 'MASCARILLA COMP EAGLE Z 200 N-VERDE', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-012V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-013G', 'GUARDAFANGO DEL EAGLE Z 200 G-VERDE', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-013G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-013N', 'GUARDAFANGO DEL EAGLE Z 200 N-NARANJA', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-013N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-013V', 'GUARDAFANGO DEL EAGLE Z 200 N-VERDE', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-013V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-014G', 'GUARDAFANGO POST EAGLE Z 200 G-VERDE', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-014G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-014N', 'GUARDAFANGO POST EAGLE Z 200 N- NARANJA', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-014N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-014V', 'GUARDAFANGO POST EAGLE Z 200 N-VERDE', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-014V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-015G', 'PLACA TANQUE (I-D) EAGLE Z 200 G-VERDE SET2', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-015G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-015N', 'PLACA TANQUE (I-D) EAGLE Z 200 N-NARANJA SET2', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-015N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-015V', 'PLACA TANQUE (I-D) EAGLE Z 200 N-VERDE SET2', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-015V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-016G', 'PLACA LAT POST (I-D) EAGLE Z 200 G-VERDE', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-016G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-016N', 'PLACA LAT POST (I-D) EAGLE Z 200 N- NARANJA', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-016N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-016V', 'PLACA LAT POST (I-D) EAGLE Z 200 N-VERDE', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-016V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-017', 'PORTA PLACAS EAGLE Z 200', 'General', 10.2800, 19.5063
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-018', 'VELOCIMETRO EAGLE Z 200', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-018')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200EGZ-022', 'CABLE ACELERADOR EAGLE Z 200', 'General', 1.2400, 2.3529
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200EGZ-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-001', 'TIMON FORCE 200/DK XTZ 250CC', 'General', 11.7000, 22.2007
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-007', 'TANQUE GASOLINA FORCE 200/DK XTZ 250CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-009', 'STOP FORCE 200/DK XTZ 250CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-013A', 'MASCARILLA COMP FORCE 200/DK XTZ 250CC AZUL', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-013A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-013B', 'MASCARILLA COMP FORCE 200/DK XTZ 250CC BLANCO', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-013B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-015A', 'PLACA TANQUE (I-D) FORCE 200/DK XTZ 250CC AZUL', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-015A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-015B', 'PLACA TANQUE (I-D) FORCE 200/DK XTZ 250CC BLANCO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-015B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-015N', 'PLACA TANQUE (I-D) FORCE 200/DK XTZ 250CC NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-015N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-015R', 'PLACA TANQUE (I-D) FORCE 200/DK XTZ 250CC ROJO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-015R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-016', 'GUARDAFANGO DEL FORCE 200/DK XTZ 250CC NEGRO', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-025', 'ESTRIBO DEL CON BASE (I-D) FORCE 200/DK XTZ 250CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-026', 'MESA DIRECCION ARMADA FORCE 200/DK XTZ 250CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-028', 'LUZ LED PLACA TANQUE (I-D) FORCE 200/DK XTZ 250CC', 'General', 14.9800, 28.4245
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-038', 'KIT FRENO DEL ARMADO FORCE 200/DK XTZ 250CC', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-038')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-046', 'APOYA MANOS Y PARRILLA (I-D) FORCE 200/DK XTZ 250CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-051', 'ABRAZADERA SUPERIOR TIMON SET2 FORCE 200/DK XTZ250/GY200/CG200 UNIVERSAL GRIS', 'General', 1.0000, 1.8975
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-051')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200FC-052', 'PALANCA AHOGADOR CARBURADOR UNIVERSAL', 'General', 0.8400, 1.5939
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200FC-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-008', 'CILINDRO Y PISTON HUNTER 200', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-012', 'KIT EMPAQUES HUNTER 200CC 2025', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-012')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-015', 'CABEZOTE COMP HUNTER 200', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-016', 'GUIA CADENILLA (1-2) HUNTER 200', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-020', 'VALVULA (AD-ES) HUNTER 200CC/EVO2/S1 ADVENTURE/AGILITY GY6 180CC', 'General', 6.5000, 12.3337
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-029', 'ROTULAS SUPERIORES HUNTER 200', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-039', 'BASE CARBURADOR HUNTER 200CC 2025/ATV 150/200CC', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-039')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-048', 'TAPA MOTOR IZQ PEQ HUNTER 200CC 2025', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-055', 'DISCO FRENO DEL 4H HUNTER 200 2025', 'General', 13.3800, 25.3885
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-055')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-070', 'PORTA CATALINA HUNTER 200 2025', 'General', 9.5400, 18.1021
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-070')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-071', 'PORTA DISCO FRENO POST HUNTER 200 2025', 'General', 9.5400, 18.1021
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-071')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-079', 'KIT FRENO DEL ARMADO HUNTER 200CC', 'General', 24.0000, 45.5400
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-079')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-080', 'MANZANA ARO POST SET2 HUNTER 200CC 2025', 'General', 6.5000, 12.3337
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-080')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-081', 'MANIGUETA FRENO DEL Y ACELERADOR CUADRON ATV 150/200CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-081')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-082', 'TAPA GASOLINA ALUMINIO GRIS HUNTER 200CC', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-082')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-083', 'MANIGUETA FRENO DEL DER HUNTER 200CC', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-083')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-084', 'BOMBA FRENO DEL DER HUNTER 200CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-084')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-087', 'CATALINA 32D/6H NEGRO HUNTER/ATV 200CC', 'General', 5.7000, 10.8157
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-087')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-088', 'MORDAZA FRENO DELANTERO DERECHO HUNTER 200 2025', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-088')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200HTR-089', 'ROTULA SUSPENSION INFERIOR SET2 HUNTER 200', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200HTR-089')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200MT-015', 'TANQUE GASOLINA MONTANA 200CC', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200MT-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200PDT-011', 'FARO LED PREDATOR 200', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200PDT-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200PDT-013', 'GUARDALODO POST PREDATOR 200/SPITFIRE 250CC', 'General', 4.0800, 7.7418
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200PDT-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200PDT-021', 'PORTA PLACAS PREDATOR 200', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200PDT-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200PDT-022', 'STOP Y LUZ PLACA PREDATOR 200', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200PDT-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-004', 'MESA DIRECCION ARMADA SHARK II 2022', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-005', 'KIT SWITCH TAPA LLAVES SHARK II 200CC 2022 CUELLO LARGO', 'General', 14.0000, 26.5650
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-009', 'TELESCOPICAS (I-D) SHARK II-SCORPION B/N NEGRO', 'General', 95.0000, 180.2625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-011', 'APOYA MANOS (I-D) SHARK II/DK200B', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-013', 'ARO DEL ARMADO 185X21 4H SHARK II 200 UNIVERSAL NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-017', 'VELOCIMETRO SHARK II 200 FONDO AMARILLO', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-020N', 'GUARDAFANGO DEL SHARK II/DK200B/SHM ARMI150/AXXO TR1 NEGRO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-020N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-020R', 'GUARDAFANGO DEL SHARK II/DK200B/SHM ARMI150/AXXO TR1 ROJO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-020R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-021N', 'PLACA TANQUE (I-D) SHARK II/DK200B/SHM ARMI150/AXXO TR1 NEGRO', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-021N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-022N', 'PLACA LAT POST (I-D) SHARK II 200 2023 N- VERDE', 'General', 32.0000, 60.7200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-022N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200SRK-025', 'ARO POST ARMADO 215X18 DISCO 4H SHARK II 200 UNIVERSAL NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200SRK-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-001N', 'GUARDAFANGO DEL WOLF/ADVENTURE 200/MAVERICK 250/RANGER CFZ 250/HONDA CB190 N- NARANJA', 'General', 14.0000, 26.5650
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-001N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-002', 'VELOCIMETRO DIGITAL WOLF/RANGER CFZ 250/HONDA CB190', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-006', 'KIT RUN Y LUCES WOLF/ADV200/RANGER CFZ 250/HONDA CB190', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-018', 'ESTRIBO DEL CON BASE (I-D) WOLF/ADV 200/RANGER CFZ 250/HONDA CB190', 'General', 32.0000, 60.7200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-018')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-038', 'MESA DIRECCION ARMADA WOLF200/RANGER CFZ 250/HONDA CB190 B/I', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-038')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-040', 'PINON VELOCIMETRO DIGITAL EJE 15MM/3PIN WOLF/ADV200/MAVERICK/WOLF250/RANGER CFZ 250/HONDA CB190 /ADV300', 'General', 7.0000, 13.2825
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-040')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-041', 'TIMON WOLF200/MAVERICK/WOLF250/RANGER CFZ 250/HONDA CB190', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-042', 'KIT FRENO DEL ARMADO WOLF/ADVENTURE 200/MAVERICK 250/RANGER CFZ 250/HONDA CB190', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-042')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-043', 'KIT FRENO POST ARMADO WOLF/ADVENTURE 200/MAVERICK 250/RANGER CFZ 250/HONDA CB190', 'General', 32.0000, 60.7200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-043')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-048', 'FILTRO AIRE HONDA CB-1/WOLF200/RANGER CFZ 250/HONDA CB190', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-051', 'STOP WOLF/ADV200/MAVERICK/WOLF250/RANGER CFZ 250/HONDA CB190', 'General', 16.0000, 30.3600
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-051')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-053N', 'ARO DEL MAGNECIO 250X17 DISCO 5H WOLF/ADV 200/MAVERICK/WOLF250/RANGER CFZ 250/HONDA CB190 NARANJA', 'General', 49.5000, 93.9262
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-053N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-053R', 'ARO DEL MAGNECIO 250X17 DISCO 5H WOLF/ADV 200/MAVERICK/WOLF250/RANGER CFZ 250/HONDA CB190 ROJO', 'General', 49.5000, 93.9262
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-053R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-053V', 'ARO DEL MAGNECIO 250X17 DISCO 5H WOLF/ADV 200/MAVERICK/WOLF250/RANGER CFZ 250/HONDA CB190 VERDE', 'General', 49.5000, 93.9262
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-053V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-056', 'ARBOL LEVAS 34T WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-056')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-059', 'CADENILLA TIPO HORUGA WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-059')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-060', 'BALANCIN SET2 WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 7.5000, 14.2312
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-060')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-068', 'CAJA CAMBIOS ARMADA LEM1543MM LEP1887MM CONTRAPESA CB200 WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-068')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-082', 'TAPA MOTOR IZQ WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 17.0000, 32.2575
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-082')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-084', 'TAPA PINON MOTRIZ WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 7.0000, 13.2825
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-084')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-087', 'CILINDRO Y PISTON 61MM/PIN13 WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-087')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-088', 'VALVULA (AD315mm-ES26mm) PICO LARGO WOLF/FORCE/SHARK 200CC/AXXO ASFALT/AXXO F51 CB200CC', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-088')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-089', 'TAPA MOTOR DER WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-089')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-090FMN', 'FARO Y MASCARILLA WOLF/RANGER CFZ 250/HONDA CB190 NEGRO', 'General', 70.0000, 132.8250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-090FMN')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-090FMR', 'FARO Y MASCARILLA WOLF/RANGER CFZ 250/HONDA CB190 ROJO', 'General', 70.0000, 132.8250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-090FMR')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-090FMT', 'FARO Y MASCARILLA WOLF/RANGER CFZ 250/HONDA CB190 NARANJA', 'General', 70.0000, 132.8250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-090FMT')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-099', 'EJE DEL.ANTERO WOLF 200CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-099')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-100', 'CAUCHOS CABEZOTE FUNDA10 WOLF/AXXO ASFALT/AXXO F51 200cc', 'General', 2.2000, 4.1745
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-100')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-101', 'CATALINA 428/45T/4H WOLF/ADV 200/MAVERICK/WOLF/RANGER CFZ 250/HONDA CB190/ADV 300 TY', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-101')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-102', 'MANIGUETA EMBRAGUE CON BASE WOLF/ADV200/RANGER CFZ 250/HONDA CB190/GY200/CG200 UNIVERSAL', 'General', 3.7000, 7.0207
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-102')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-103', 'KIT PISTAS DIRECCION WOLF/RANGER CFZ 250/HONDA CB190', 'General', 6.7500, 12.8081
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-103')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-115R', 'PLACA LAT POST (I-D) WOLF/RANGER CFZ 250/HONDA CB190 ROJO', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-115R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-115T', 'PLACA LAT POST (I-D) WOLF/RANGER CFZ 250/HONDA CB190 NARANJA', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-115T')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB200WF-123', 'EMPAQUE CAUCHO CABEZOTE WOLF/PREDATOR/AXXO ASFALT-F51 200CC', 'General', 2.6200, 4.9714
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB200WF-123')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-021', 'ESTRELLA CAMBIOS CB 250CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-038', 'AUTOMATICO ARRANQUE CG 125/150/CB200/250 UNIVERSAL', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-038')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-078', 'PINON VELOCIMETRO EJE 12MM CRUCERO/SHARK1/SCO B/I/GN125 UNIVERSAL', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-078')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-196.', 'MASCARILLA FARO RX 250.', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-196.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-212R', 'GUARDAFANGO DEL BULL 250 ROJO', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-212R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-305', 'MOTOR ARRANQUE TEKKEN 2V 11D', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-305')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-319', 'CABEZOTE COMP RE250 TEKKEN EVO/CROSSFIRE/SCRAMBLER/ADV-R/GP1 250CC', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-319')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-345', 'KIT MALETAS SET3 CON BASE TEKKEN EVO/AXXO TRACKER 250CC', 'General', 135.0000, 256.1625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-345')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250-417', 'CARTER IZQ RX/SHARK/BULL/SCO 200-250 GRIS', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250-417')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-001', 'KIT RUN Y LUCES ADVENTURE-R 250/300CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-002', 'MANIGUETA EMBRAGUE CON BASE ADVENTURE-R 250/300CC', 'General', 3.9000, 7.4002
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-003', 'KIT SWITCH,TAPA,LLAVES ADVENTURE-R 250/300CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-005', 'BOMBA GASOLINA ADVENTURE-R 250/300CC/GP1 250CC', 'General', 3.1200, 5.9202
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-008', 'PEDAL FRENO ADVENTURE-R 250/300CC', 'General', 11.5700, 21.9541
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-009', 'ESTRIBO DEL (I-D) ADVE-R 250', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-018', 'DISCO FRENO POST 3H ADVENTURE-R 250/300CC', 'General', 16.9000, 32.0677
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-018')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-020', 'PASTILLAS FRENO POST ADVENTURE-R 250/300CC', 'General', 4.5000, 8.5387
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-021', 'MANIGUETA FRENO DEL ADVENTURE-R 250/300CC NEGRO', 'General', 2.2500, 4.2694
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-022', 'KIT FRENO POST ARMADO ADVENTURE-R 250/300CC', 'General', 33.8000, 64.1355
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-025', 'ASIENTO ADVENTURE-R 250/300CC', 'General', 33.8000, 64.1355
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-027', 'BOYA GASOLINA ADVENTURE-R 250/300CC', 'General', 3.9000, 7.4002
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-032', 'INSTALACION ELECTRICA ADVENTURE R 250', 'General', 23.4000, 44.4015
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-041', 'CAUCHO DESLIZ CADENA ADVENTURE-R 250/300CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-044', 'PORTA PLACAS ADVENTURE-R 250/300CC', 'General', 15.6000, 29.6010
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-044')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-045', 'CUBRE CADENA ADVENTURE R 250', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-045')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-047', 'PROTEC ESCAPE ADVENTURE-R 250/300CC', 'General', 13.0000, 24.6675
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-047')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-053B', 'PLACA TANQUE (I-D) ADVENTURE R 250 BLANCO SET10', 'General', 80.0000, 151.8000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-053B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-054B', 'PLACA LAT POST (I-D) ADVENTURE R 250 BLANCO', 'General', 46.8000, 88.8030
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-054B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-057', 'TELESCOPICAS (I-D) ADVENTURE R 250 B/N', 'General', 160.0000, 303.6000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-057')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-058', 'KIT PISTAS DIRECCION ADVENTURE-R 250/300CC', 'General', 11.7000, 22.2007
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-058')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-064', 'TELESCOPICAS (I-D) ADVENTURE-R 300 B/I', 'General', 160.0000, 303.6000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-064')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-065', 'PINON VELOCIMETRO DIGITAL ADVENTURE R 300CC B/I', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-065')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-068', 'DISCO FRENO DEL 6H ADVENTURE-R 300CC', 'General', 13.3400, 25.3126
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-068')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-069', 'PINON VELOCIMETRO DIGITAL ADVENTURE R 250CC B/N', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-069')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250ADV-072', 'ARO POST. ARMADO Y LLANTA ADVENTURE-R 250/300CC', 'General', 80.0000, 151.8000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250ADV-072')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250CRF-047', 'DISCO FRENO POST CROSSFIRE/XTREEM/THUNDER F16/DK HORNET/IGM WIND250/Z1 V8200', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250CRF-047')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250CRF-059', 'CATALINA 42D Y CADENA 520-NG CROSSFIRE/XTREEM/THUNDER F16/DK HORNET/IGM WIND250/Z1 V8200', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250CRF-059')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-002', 'MANIGUETA EMBRAGUE CON BASE GP1 250/TUNDRA VELOCE 250CC', 'General', 5.3400, 10.1326
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-006', 'KIT SWITCH,TAPA,LLAVES GP1 250/TUNDRA VELOCE 250CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-011', 'DISCO FRENO DEL GP-1 250', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-011NM', 'DISCO FRENO DEL 5H DIN150MM DEX300MM GP-1 250CC 2023/24/2025', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-011NM')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-013', 'KIT FRENO DEL ARMADO GP1 250/TUNDRA VELOCE 250CC', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-014', 'MANIGUETA FRENO GP1 250/TUNDRA VELOCE 250CC', 'General', 2.6000, 4.9335
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-023', 'ESTRIBOS ARMADOS CON BASE (I-D) GP1 250/TUNDRA VELOCE 250CC', 'General', 65.0000, 123.3375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-024', 'TELESCOPICAS (I-D) GP1 250/TUNDRA VELOCE 250CC BUJE 12MM 2017-18-19-20-2021 B/I NEGRO', 'General', 150.0000, 284.6250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-025', 'MONOSHOCK 320MM GP1 250/TUNDRA VELOCE 250CC ROJO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-027', 'VELOCIMETRO DIGITAL GP1 250/TUNDRA VELOCE 250CC', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-029', 'PORTA PLACAS GP1 250/TUNDRA VELOCE 250CC', 'General', 16.0000, 30.3600
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-031', 'DIRECCIONALES (SET4) GP1 250/TUNDRA VELOCE 250CC', 'General', 16.4900, 31.2898
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-043R', 'PLACA LAT POST (I-D) GP1 250/TUNDRA VELOCE 250CC ROJO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-043R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-052', 'FILTRO AIRE GP1 250/TUNDRA VELOCE 250CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-057', 'CABLE AHOGADOR GP1 250/TUNDRA VELOCE 250CC', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-057')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-063NM', 'TELESCOPICAS (I-D) GP1 250CC 2023/24/2025 BUJE 15MM B/I NEGRO', 'General', 130.0000, 246.6750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-063NM')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-068R', 'PLACA TANQUE SUP (I-D) GP1 250/TUNDRA VELOCE 250CC G-ROJO', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-068R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-068V', 'PLACA TANQUE SUP (I-D) GP1 250/TUNDRA VELOCE 250CC VERDE', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-068V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250GP1-072', 'CATALINA Y PINON 520H GP1 250/TUNDRA VELOCE 250CC', 'General', 16.0000, 30.3600
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250GP1-072')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250HTR-012', 'SWITCH HUNTER 200', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250HTR-012')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250MVK-014', 'EJE BALANCEADOR WOLF 250CC /MAVERICK', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250MVK-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250MVK-035', 'FILTRO AIRE WOLF 200/250/MAVERICK 250/ADVENTURE 300 6 PATAS', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250MVK-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250MVK-045B', 'PLACA LAT POST (I-D) MAVERICK 250 BLANCO', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250MVK-045B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250MVK-045R', 'PLACA LAT POST (I-D) MAVERICK 250 N-ROJO', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250MVK-045R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SC-052', 'MASCARILLA FARO SCORPION 250 ROJO', 'General', 10.6700, 20.2463
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SC-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SC-078', 'ARO DEL ARMADO SCORPION 200/250CC B/N', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SC-078')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SC-099', 'TELESCOPICAS (I-D) SCORPION 250/AXXO TRX/TH MIG25/DK250-D SPORT 250CC B/I', 'General', 150.0000, 284.6250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SC-099')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SC-106', 'KIT FRENO DEL ARMADO SCORPION 200/250/AXXO TRX/TH MIG25/DK250-D SPORT 250CC B/I', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SC-106')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SC-108', 'ARO DEL ARMADO SCORPION 250/AXXO TRX/TH MIG25/DK250-D SPORT 250CC B/I', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SC-108')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SC-115', 'TELESCOPICAS (I-D) SCORPION/BULL/SHARK II PLOMO B/N', 'General', 95.0000, 180.2625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SC-115')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SC-116A', 'FARO Y MASCARILLA SCORPION 200/250/AXXO TRX/TH MIG25/DK250-D SPORT 250CC B-ROJO 2023/24/2025', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SC-116A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SC-116B', 'FARO Y MASCARILLA SCORPION 200/250/AXXO TRX/TH MIG25/DK250-D SPORT 250CC B-NEGRO 2023/24/2025', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SC-116B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-001', 'ESCAPE COMP SCRAMBLER CLASICA/REVOLUTION/AXXO SCRAMBLER 250CC', 'General', 60.0000, 113.8500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-002', 'VELOCIMETRO DIGITAL SCRAMBLER CLASICA/REVOLUTION/AXXO SCRAMBLER 250CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-045', 'CABLE AHOGADOR SCRAMBLER CLASICA/REV/AXXO SCRAMBLER', 'General', 2.0000, 3.7950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-045')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-069V', 'PLACA LAT POST (I-D) SCRAMBLER REVOLUTION 250CC VERDE', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-069V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-074', 'TAPA MOTOR IZQ SCRAMBLER CLASICA/REV/AXXO SCRAMBLER NEGRO COMPLETA', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-074')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-077', 'KIT FRENO DEL. ARMADO SCRAMBLER CLASICA/REVOLUTION/AXXO SCRAMBLER 250CC/300CC', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-077')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-089', 'PROTEC ESCAPE FIBRA CARBONO SCRAMBLER CLASICA/REVOLUTION 250CC/300CC', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-089')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-090', 'VELOCIMETRO DIGITAL SCRAMBLER FE300CC/TEKKEN DISCOVERI 300CC', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-090')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250SCB-091', 'EMBLEMAS TANQUE SCRMABLER REV 250 SET2', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250SCB-091')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-009', 'DEPURADOR AIRE TEKKEN EVO/AXXO TRACKER/DK NATIVA 250CC', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-019', 'PEDAL FRENO TEKKEN EVO/AXXO TRACKER/DK NATIVA 250CC', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-028', 'BASE CARBURADOR PEQUENO TEKKEN EVO/AXXO TRACKER UNIVERSAL', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-039', 'VELOCIMETRO DIGITAL TEKKEN EVO/AXXO TRACKER/DK NATIVA 250CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-039')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-045', 'ASIENTO TEKKEN EVO/AXXO TRACKER/DK NATIVA 250CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-045')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-054B', 'PLACA LAT. POST. (I-D) TEKKEN EVO N-ROJO Y BLANCO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-054B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-054N', 'PLACA LAT. POST. (I-D) TEKKEN EVO N-VERDE', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-054N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-063', 'TROMPOS FRENO DEL - EMBRAGUE (SET2) TEKKEN EVO/AXXO TRACKER/DK NATIVA 250CC', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-063')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250TKN-070', 'VELOCIMETRO DIGITAL TEKKEN EVO/DK NATIVA 250CC 2025', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250TKN-070')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB250WF-008', 'PROTEC ESCAPE WOLF 250', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB250WF-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SCB-006', 'PROTEC RADIADOR (SET3) SCRAMBLER 300 MAX', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SCB-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SCB-008G', 'PLACA LAT POST (I-D) SCRAMBLER 300 MAX GRIS', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SCB-008G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SCB-009', 'PINON VELOCIMETRO DIGITAL EJE 12MM/3PIN SCRAMBLER MAX 300CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SCB-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-002G', 'PLACA LAT POST (I-D) SUPER WOLF 300 G- VERDE', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-002G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-004', 'PROTEC MOTOR TIBURON SUPER WOLF 300 NEGRO', 'General', 16.0000, 30.3600
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-009', 'LUZ LED PLACA TANQUE SUPER WOLF 300', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-020', 'TELESCOPICAS (I-D) SUPER WOLF 300 B/I', 'General', 150.0000, 284.6250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-021', 'MONOSHOCK 280MM (TIPO U) SUPER WOLF 300', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-029', 'BOTELLON REFRIGERANTE SUPER WOLF 300', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-035', 'CARTER IZQ SUPER WOLF 300/SCRAMBLER 300', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-041', 'EJE BALANCEADOR ARMADO SUPER WOLF 300', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-052', 'KIT FRENO POST ARMADO SUPER WOLF 300', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-072', 'TAPA PINON MOTRIZ SUPER WOLF 300', 'General', 5.9000, 11.1952
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-072')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CB300SW-081', 'PESAS TIMON (I-D) SUPER WOLF 300', 'General', 3.2200, 6.1099
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CB300SW-081')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-002', 'GUARDAFANGO DEL. XPOWER/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC BLANCO B/N', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-002BI', 'GUARDAFANGO DEL. XPOWER 250 BLANCO BARRAS INVERTIDAS', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-002BI')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-004', 'PLACA LAT. POST. (I-D) XPOWER/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC N-NARANJA', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-007', 'ESPEJOS (I-D) XPOWER/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-010', 'PORTA PLACAS XPOWER/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-017', 'MESA DIRECCION ARMADA XPOWER/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC B/N', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-017BI', 'MESA DIRECCION ARMADA XPOWER 250 BARRAS INVERTIDAS', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-017BI')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-019', 'KIT FRENO DEL. ARMADO GP1R/CHIEF II 250CC/FACTORY FK370CC B/N', 'General', 34.9900, 66.3935
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-022', 'DISCO FRENO POST. XPOWER/GP1-R/CHIEF II/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-025', 'KIT FRENO POST. ARMADO XPOWER/GP1- R/CHIEFF II 250/FK370/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC', 'General', 36.0000, 68.3100
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-027', 'CUBRE CADENA XPOWER/GP1-R/CHIEF II 250/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-028', 'KIT RUN Y LUCES XPOWER/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-031', 'FLASH 3PIN CON CABLE XPOWER/GP1R 250CC/S1/EIVISSA/S1ADV/EVO2/AGILITY 180CC SCOOTER', 'General', 1.8600, 3.5293
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-036', 'ESTRIBO DEL. CON BASE (I-D) XPOWER/GP1-R 250/FK370/FK 400/F 370/CHEF II/CHIEF II PRO/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-053', 'ARBOL LEVAS 34T XPOWER/TEKKEN/CROSSFIRE/ADV-R/SCRAMBLER/CHIEF II 250CC ( 2V ) 2018-19-20-2022', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-053')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-055', 'TAPA MOTOR DER. XPOWER/CHIEF II 250CC ( 2V ) 2019-20-2022', 'General', 25.8900, 49.1263
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-055')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-069', 'KIT PINONES ARRANQUE 57T/60-16T/16-16T XPOWER/CHIEF II 250CC ( 2V ) 2019-20-2022', 'General', 11.5900, 21.9920
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-069')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CBB250XP-086', 'PROTEC. ESCAPE (FIBRA CARBONO) XPOWER/GP1R/THD SR71/PEGASSO DUKK 250CC/FACTORY FZ 300CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CBB250XP-086')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-134A', 'PLACA LATERAL (I-D) GN AZUL', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-134A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-136', 'TANQUE GASOLINA SIN BOYA CRUCERO NEGRO', 'General', 24.3400, 46.1851
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-136')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-136A', 'TANQUE GASOLINA SIN BOYA CRUCERO AZUL', 'General', 24.3400, 46.1851
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-136A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-136R', 'TANQUE GASOLINA SIN BOYA CRUCERO ROJO', 'General', 24.3400, 46.1851
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-136R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-166', 'EJE PEDAL CAMBIOS 205MM CG150/200 WEV I- II/CAFE RACER/DELTA/CRUCERO/SPITFIRE/WOLF/ADV', 'General', 3.4500, 6.5464
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-166')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-199', 'KIT FRENO DEL. ARMADO DELTA/PANTHER/AXXO RAPTOR/DK TIGER 150CC', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-199')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-202', 'DIRECCIONALES (I-D) SET4 DELTA/PANTHER/INDY 150CC UNIVERSAL', 'General', 9.8000, 18.5955
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-202')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-212', 'VELOCIMETRO DELTA/IGM EC150/SK STIFF/AXXO AX150/TUKO H1 150CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-212')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-221', 'MANIGUETA FRENO DEL. CG150 NEGRO.', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-221')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-266', 'AMORTIGUADOR (I-D) ZERO 150CC N-ROJO', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-266')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-292', 'TAPA MOTOR DER. SPIT/WING 150CC. ANTIGUA', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-292')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-298', 'TAPA MOTOR IZQ. SPITFIRE/WING 150.', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-298')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-308', 'CABLE VELOCIMETRO SPITFIRE 150CC', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-308')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-309', 'CABLE AHOGADOR SPITFIRE 150CC', 'General', 1.0000, 1.8975
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-309')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-397', 'BENDIX ARRANQUE CRUCERO 200/WING EVO 200CC 9RODILLO SL/KM', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-397')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-450', 'CIGUENAL ARMADO PIN13 CRUCERO/SPITFIRE/WORKFORCE 150CC YH', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-450')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-451', 'CILINDRO Y PISTON CG150 UNIVERSAL PIN 13', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-451')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150-999', 'PESAS TIMON (I-D) CG125/150/200CC UNIVERSAL', 'General', 2.0000, 3.7950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150-999')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150CR-020', 'ESPEJOS (I-D) CAFE RACER 150/170/SCRAMBLER 250/300CC UNIVERSAL DE TIMON', 'General', 13.0000, 24.6675
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150CR-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150CR-032', 'MANIGUETA EMBRAGUE CON BASE CAFE RACER 150/170', 'General', 2.2000, 4.1745
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150CR-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150CRU-002', 'CILINDRO Y PISTON CG150 PIN 14', 'General', 31.2000, 59.2020
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150CRU-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150CRU-010', 'CIGUENAL ARMADO PIN14 /LT230MM/LB140MM CRUCERO/SPITFIRE/WORKFORCE 150CC YH', 'General', 39.0000, 74.0025
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150CRU-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150CRU-027', 'ARO DEL. MAGNECIO 1.60X18 DISCO 4H GN125/CRUCERO 150 CROMADO', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150CRU-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150CRU-032G', 'TANQUE GASOLINA BOYA CRUCERO 150/200 GRIS', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150CRU-032G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150CRU-032R', 'TANQUE GASOLINA BOYA CRUCERO 150/200 ROJO', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150CRU-032R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150CRU-035', 'ESPALDAR POSTERIOR CRUCERO 150/GN UNIVERSAL', 'General', 7.7000, 14.6107
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150CRU-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-001B', 'PLACA LATERAL (I-D) DELTA/SK STIFF/AXXO AX150/TUKO H1 150CC BLANCO', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-001B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-001R', 'PLACA LATERAL (I-D) DELTA/SK STIFF/AXXO AX150/TUKO H1 150CC ROJO', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-001R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-005', 'STOP DELTA', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-009R', 'GUARDAFANGO DEL. DELTA/SK STIFF/AXXO AX150/TUKO H1 150CC ROJO', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-009R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-010', 'ARO DEL. MAGNECIO 1.40X18 DISCO 5H DELTA150/WY125/FX200 NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-012', 'PARRILLA POST. DELTA/PANTHER/SK STIFF150/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-012')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-013', 'PINON VELOCIMETRO EJE 12MM DELTA/CAFE RACER/SH XY150CC', 'General', 3.1700, 6.0151
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-014', 'PORTA ZAPATAS DELTA', 'General', 8.5000, 16.1287
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-015', 'OSCILANTE DELTA', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-021', 'BOYA GASOLINA DELTA', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-023', 'PROTEC. ESCAPE DELTA/PANTHER/INDY 150CC GRIS', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-027', 'CARTER DER. CG150 UNIVERSAL', 'General', 20.9000, 39.6577
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-029', 'DEPURADOR AIRE DELTA-PANTHER', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-030', 'CABLE SET3 (EM-AC-VE) DELTA-PANTHER- INDY', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-031', 'KIT RUN Y LUCES DELTA 150', 'General', 10.5000, 19.9237
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150DELT-036', 'PATA APOYO CENTRAL INDY/DELTA/PANTHER 150CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150DELT-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150IND-002', 'TELESCOPICAS (I-D) DELTA/PANTHER/WORKFORCE 150 NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150IND-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150IND-005', 'PEDAL FRENO DELTA/PANTHER/INDY 150', 'General', 3.6000, 6.8310
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150IND-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150IND-011', 'MESA DIRECCION ARMADA DELTA/PANTHER/INDY 150/WORKFORCE', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150IND-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150LP-001', 'FARO DOBLE FOCO CG150 UNIVERSAL', 'General', 4.4000, 8.3490
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150LP-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150LP-015', 'KIT RUN Y LUCES LEOPARD 150CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150LP-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-003', 'PEDAL FRENO PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC', 'General', 7.8000, 14.8005
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-011', 'KIT SWITCH,TAPA,LLAVES PANTHER/DELTA 150/SK STIFF150/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC', 'General', 8.6900, 16.4893
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-014', 'KIT FRENO DEL. ARMADO PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC', 'General', 22.3800, 42.4660
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-016', 'ARO DEL. MAGNECIO 1.60X18 DISCO 4H PANTHER/STIFF 150 NEGRO', 'General', 37.0000, 70.2075
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-022', 'TELESCOPICAS (I-D) PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC GRIS', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-036', 'ESTRIBO POST. CON BASE (I-D) PANTHER/DELTA 150/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC', 'General', 9.0000, 17.0775
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-037B', 'GUARDAFANGO DEL. PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC BLANCO', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-037B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-037R', 'GUARDAFANGO DEL. PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC ROJO', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-037R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-041', 'LUZ LED PLACA TANQUE (I-D) PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/THUNDER RT 150CC', 'General', 13.4800, 25.5783
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-045B', 'PLACA TANQUE (I-D) PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC BLANCO', 'General', 38.0000, 72.1050
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-045B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-046', 'PLACA LATERAL (I-D) PANTHER 150CC 2021/22/23/2024/PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC NEGRO', 'General', 14.0000, 26.5650
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150PTH-049', 'CABLE SET3 (EMB-VEL-ACE) PANTHER/RANGER 150USM//IGM ECO150/TK H2EVO/AXXO RAPTOR 150/THUNDER RT 150CC', 'General', 4.1600, 7.8936
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150PTH-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-001R', 'MASCARILLA COMP. SPITFIRE 150CC 2025 G- ROJO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-001R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-001V', 'MASCARILLA COMP. SPITFIRE 150CC 2025 G- VERDE', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-001V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-003R', 'PLACA TANQUE (I-D) SPITFIRE 150CC 2025 G- ROJO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-003R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-003V', 'PLACA TANQUE (I-D) SPITFIRE 150CC 2025 G- NEGRO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-003V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-006', 'MESA DIRECCION ARMADA SPITFIRE 150CC 2025', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-014', 'CABLE ACELERADOR SPITFIRE 150CC 2025', 'General', 1.9000, 3.6052
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-016', 'VELOCIMETRO DIGITAL SPITFIRE 150CC 2025', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-019', 'PORTA PLACAS SPITFIRE 150CC 2025', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-020', 'GUARDALODO SPITFIRE 150CC 2025', 'General', 20.6800, 39.2403
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SF2-023', 'TELESCOPICAS (I-D) SPITFIRE 150CC 2025 31mm', 'General', 65.0000, 123.3375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SF2-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SP-001', 'PORTA PLACAS SPITFIRE 150', 'General', 15.6000, 29.6010
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SP-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SP-003', 'TAPA MOTOR DER. SPITFIRE 150 TITANIO', 'General', 20.8000, 39.4680
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SP-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SP-004B', 'PLACA TANQUE (I-D) SPITFIRE 150 BLANCO', 'General', 20.8000, 39.4680
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SP-004B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SP-004R', 'PLACA TANQUE (I-D) SPITFIRE 150 ROJO', 'General', 20.8000, 39.4680
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SP-004R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SP-005B', 'GUARDAFANGO DEL. SPITFIRE 150 N-BLANCO', 'General', 18.2000, 34.5345
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SP-005B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SPF-008', 'APOYA MANOS (I-D) SPITFIRE 150', 'General', 18.2000, 34.5345
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SPF-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150SPF-036N', 'PLACA LAT. POST. (I-D) SPITFIRE 150 NEGRO', 'General', 39.0000, 74.0025
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150SPF-036N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WING-029', 'KIT FRENO DEL. WING 150 UNIVERSAL', 'General', 7.7000, 14.6107
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WING-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-016', 'CATALINA 428/38T/4H COCODRIL WORKFORCE/TH-B52 150CC', 'General', 5.2000, 9.8670
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-044A', 'ARO DEL. MAGNECIO 1.60X18 DISCO 5H WORKFORCE-S VERDE NEON', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-044A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-044V', 'ARO DEL. MAGNECIO 1.60X18 DISCO 5H WORKFORCE-S VERDE', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-044V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-046', 'GUARDAFANGO POST. WORKFORCE-S', 'General', 5.5000, 10.4362
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-048', 'CABLE VELOCIMETRO - TACOMETRO WORKFORCE-S', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-050A', 'GUARDAFANGO DEL. WORKFORCE-S N-AZUL', 'General', 13.0000, 24.6675
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-050A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-052A', 'TANQUE GASOLINA WORKFORCE-S AZUL', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-052A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-060', 'GUARDAFANGO DEL. WORKFORCE 150CC ANIVERSARIO NEGRO', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-060')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-071', 'CAUCHO DESLIZADOR CADENA SHM XY150/TUNDRA TD150CG(19-22)/ICS 150S(22-23) UNIVERSAL', 'General', 0.9800, 1.8595
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-071')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG150WRF-136B', 'TANQUE GASOLINA WORKFORCE/TH-B52 150CC BLANCO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG150WRF-136B')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200-027', 'SELECTOR CAMBIOS ARMADO CG200 WINGEVO I- II/CAFE RACER 170/CRUCERO 200', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200-030.', 'KIT EMPAQUES CG200.', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200-030.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-003', 'APOYA MANOS (I-D) SPEED 200', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-005', 'ESTRIBO POST. (I-D) SPEED 200', 'General', 0.0000, 0.0000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-014', 'CABLE ACELERADOR SPEED 200', 'General', 2.0000, 3.7950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-027', 'KIT FRENO DEL. ARMADO SPEED 200/DK DRAGON 200.', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-028', 'KIT RUN Y LUCES SPEED 200', 'General', 12.2800, 23.3013
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-030', 'STOP Y LUZ PLACA SPEED 200', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-034', 'MESA DIRECCION ARMADA SPEED 200', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-034')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-049', 'PROTEC. ESCAPE SPEED 200/DK DRAGON200', 'General', 19.0000, 36.0525
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-055.', 'KIT PISTON SPEED200/CG200 198CC.', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-055.')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-058', 'LUZ PLACA SPEED 200/SPITFIRE 250 2023', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-058')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-073', 'PORTA CATALINA ARMADA SPEED 200', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-073')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-074', 'MONOSHOCK 320MM SPEED 200/BROSS/GY200 NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-074')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-078', 'CUBRE CADENA SPEED 200', 'General', 9.0000, 17.0775
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-078')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SPE-079', 'PEDAL FRENO SPEED 200', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SPE-079')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SR1-007', 'TELESCOPICAS (I-D) SHARK1 200B 2024', 'General', 90.0000, 170.7750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SR1-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SR1-011R', 'PLACA LAT. POST. (I-D) SHARK1 200B 2024 ROJO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SR1-011R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SR1-012R', 'PLACA TANQUE (I-D) SHARK1 200B 2024 ROJO', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SR1-012R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SR1-018G', 'GUARDAFANGO POSTERIOR SHARK1 200B 2024 GRIS', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SR1-018G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SR1-020', 'FARO SHARK1 200B 2024', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SR1-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SR1-025', 'KIT RUN Y LUCES SHARK1 200B 2024', 'General', 13.0000, 24.6675
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SR1-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SR1-031', 'STOP SHARK1 200B 2024', 'General', 7.7000, 14.6107
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SR1-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200SR1-032', 'PORTA PLACAS SHARK1 200B 2024', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200SR1-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-001', 'VELOCIMETRO DIGITAL WING EVO 200/Z1 PHANTON/AXXO R51/IGM WIND 200CC', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-008', 'TELESCOPICAS (I-D) WING EVO 200/ 31mm', 'General', 65.0000, 123.3375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-010', 'KIT RUN Y LUCES WING EVO 200/Z1 PHANTON/AXXO R51/IGM WIND 200CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-013', 'TIMON WING EVO 200/Z1 PHANTON/AXXO R51/IGM WIND 200CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-016', 'GUARDALODO POST. WING EVO 200/Z1 PHANTON/AXXO R51/IGM WIND 200CC', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-017', 'DISCO FRENO DEL DEXT 240MM DINT 50MM WING EVO I/II 200/Z1 PHANTON/AXXO R51/IGM WIND 200CC', 'General', 8.5000, 16.1287
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-023', 'APOYA MANOS (I-D) WING EVO 200/Z1 PHANTON/AXXO R51/IGM WIND 200CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-024', 'KIT FRENO DEL. ARMADO WING EVO 200', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-039', 'ASIENTO WING EVO 200/Z1 PHANTOM/AXXO R51 200CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-039')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-044', 'VALVULA (AD31mm-ES27mm) PICO LARGO CRUCERO200/WING EVO I/II/GP 200CC', 'General', 6.5200, 12.3717
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-044')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-046', 'BASE CARBURADOR WING EVO 200', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-052K', 'CILINDRO Y PISTON CRUCERO 200/WING EVO I/II/SL-KM PIN 15 NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-052K')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV-078', 'DEPURADOR AIRE WING EVO 200', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV-078')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-003', 'ESCAPE COMP. WING EVO 2', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-005', 'DEPURADOR AIRE WING EVO2 2018/19/20/21/2022/2025/SHM GP200/Z1 AK200/AXXO F51/RANGER VENOOM F51/TUNDRA VENOM/PEGASSO VENTO/MT1 FX 200CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-006', 'STOP WING EVO2 2018/19/20/21/2022/SHM GP200/Z1 AK200/AXXO F51/RANGER VENOOM F51/TUNDRA VENOM/PEGASSO VENTO/MT1 FX 200CC', 'General', 14.6200, 27.7414
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-010', 'VELOCIMETRO DIGITAL WING EVO2 2018/19/20/21/2022/SHM GP200/Z1 AK200/AXXO F51/RANGER VENOOM F51/TUNDRA VENOM/PEGASSO VENTO/MT1 FX 200CC', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-024', 'TELESCOPICAS (I-D) WING EVO 2 2018/32mm', 'General', 60.0000, 113.8500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-030', 'OSCILANTE WING EVO II 200CC 2020- 2024/PREDATOR 200 2025', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-044', 'KIT FRENO DEL. ARMADO WING EVO2 2018/19/20/21/2022/SHM GP200/Z1 AK200/AXXO F51/RANGER VENOOM F51/TUNDRA VENOM/PEGASSO VENTO/MT1 FX 200CC', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-044')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-047', 'PATA LAT. - CENTRAL SET2', 'General', 7.7000, 14.6107
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-047')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-050V', 'ARO DEL. MAGNECIO 1.85X17 DISCO 4H WING EVO-2/SH GP200 2018 VERDE', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-050V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEV2-052', 'MESA DIRECCION ARMADA WING EVO 2 2018 32MM', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEV2-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEVO-045', 'CILINDRO Y PISTON WING EVO I/II 200 PIN 13', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEVO-045')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEVO-048', 'EJE BALANCEADOR ARMADO WING EVO PIN 13', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEVO-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEVO-050', 'KIT PINONES ARRANQUE 57T/60-17T/17-16T WING EVO II 200', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEVO-050')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEVO-051', 'KIT EMBRAGUE ARMADO 6H/6D-73D CRUCERO200/WING EVOI/II/GP 200CC', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEVO-051')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEVO-052', 'CABEZOTE COMP. WING EVO II 200CC PIN 13', 'General', 65.0000, 123.3375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEVO-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WEVO-057', 'CARTER IZQ. WING EVO II PIN 13', 'General', 38.0000, 72.1050
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WEVO-057')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WINGEV-005', 'KIT CAUCHOS - ESTRIBO - MANUBRIOS WING EVO 2 2024/2025/TD VENOM GT/TH R200/TK CR3 MAX 200CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WINGEV-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CG200WINGEV-028', 'MANIGUETA FRENO DEL. WING EVO 2 2024/2025/TD VENOM GT/TH R200/TK CR3 MAX 200CC/CG200/GY200 UNIVERSAL NEGRO', 'General', 2.6000, 4.9335
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CG200WINGEV-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-005', 'TELESCOPICAS (I-D) COMANDER 200 NEGRO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-006', 'VELOCIMETRO DIGITAL COMANDER 200', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-008', 'ESPEJOS (I-D) COMANDER 200', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-009', 'ESTRIBO DEL.S (I-D) COMMANDER 200', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-015', 'FARO LED COMMANDER 200', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-016', 'STOP COMMANDER 200', 'General', 4.5000, 8.5387
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-017', 'DIRECCIONALES (SET4) COMMANDER 200', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-021', 'CABLE SET3 (AC-EMB-AHO) COMMANDER 200', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-026', 'GUARDAFANGO DEL. COMMANDER 200', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CMD-028N', 'PLACA LATERAL (I-D) COMMANDER 200 NEGRO', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CMD-028N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CRU-003', 'TAPA MOTOR IZQ. Y PINON CRUCER0 200 GRIS', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CRU-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CRU-016', 'TAPA MOTOR DER. CRUCERO 200 GRIS SL', 'General', 23.0000, 43.6425
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CRU-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CRU-017', 'KIT EMPAQUES 6 PCS (CIL-CAB-TMD-TMI-CEN- CAUCH) CRUCERO 200 SL', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CRU-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200CRU-020', 'CARTER DER. CRUCERO 200 SL GRIS', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200CRU-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-005', 'VELOCIMETRO DIGITAL GTR/ROADSTER', 'General', 32.0000, 60.7200
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-008R', 'PLACA TANQUE (I-D) GTR 200 N-ROJO', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-008R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-009', 'PLACA LAT. POST. (I-D) GTR 200 ROJO', 'General', 47.3800, 89.9035
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-009PR', 'PLACA LAT. POST. (I-D) GTR 200 GRIS MATE/ROJO', 'General', 47.3800, 89.9035
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-009PR')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-009PV', 'PLACA LAT. POST. (I-D) GTR 200 GRIS VERDE BRILLANTE', 'General', 47.3800, 89.9035
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-009PV')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-022', 'DISCO FRENO DEL. GTR 200', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-024', 'APOYA MANOS (I-D) GTR 200', 'General', 19.0500, 36.1474
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-025', 'PROTEC. MOTOR TIBURON GTR200/MAVERICK/WOLF 250CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-032', 'CAMPANA BOMBA ACEITE GTR 200', 'General', 3.3400, 6.3376
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-042', 'BASE CARBURADOR GTR 200', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-042')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTR-043', 'ARBOL LEVAS 44T GTR-WEV 200', 'General', 8.6000, 16.3185
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTR-043')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTRRD-009', 'EMBLEMAS TANQUE SET4 GTR ROADSTER', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTRRD-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB200GTRRD-016', 'VALVULA RECIRCULACION GASES EURO/CG150-200/CB200-250CC UNIVERSAL', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB200GTRRD-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB250SPF-012', 'KIT FRENO DEL. ARMADO SPITFIRE/M1 STEFF 250CC', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB250SPF-012')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB250SPF-033', 'PARRILLA SPITFIRE 250', 'General', 21.0300, 39.9044
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB250SPF-033')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB250SPF-036', 'LUZ LED PLACA TANQUE SPITFIRE 250', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB250SPF-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB250SPF-042', 'PEDAL FRENO SPITFIRE 250', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB250SPF-042')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGB250SPF-075', 'CABLE AHOGADOR 970MM SPITFIRE 250', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGB250SPF-075')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-015', 'KIT BALANCIN ARMADO CABEZOTE EAGLE I-II- III/DK FALCON', 'General', 4.9900, 9.4685
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-032', 'KIT RUN Y LUCES EAGLE 150CC I-II-III/DK FALCON', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-032')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-033', 'MOTOR ARRANQUE EAGLE', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-033')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-036', 'ARO DEL. ARMADO 1.40X19 4H EAGLE150CC I-II- III/DK FALCON NEGRO', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-045', 'TELESCOPICAS (I-D) EAGLE 150CC I-II-III-V/DK FALCON GRIS', 'General', 75.0000, 142.3125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-045')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-099', 'KIT FRENO DEL. ARMADO EAGLE I-II-III/DK FALCON 150CC', 'General', 33.8200, 64.1735
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-099')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-101', 'FARO EAGLE 150CC III/DK FALCON', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-101')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-103', 'VELOCIMETRO EAGLE 150CC III/DK FALCON', 'General', 23.0000, 43.6425
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-103')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-114', 'PATA APOYO LAT. 610MM EAGLE 150CC I-II- III/DK FALCON', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-114')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-128', 'PASTILLAS FRENO DEL. EAGLE 150CC I-II- III/MONTANA150/DK FALCON', 'General', 2.0000, 3.7950
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-128')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-136', 'DISCO FRENO POST. EAGLE 150CC III/DK FALCON', 'General', 7.7500, 14.7056
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-136')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-146', 'LUZ PLACA EAGLE 150CC III/DK FALCON.', 'General', 6.5000, 12.3337
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-146')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-147A', 'PLACA LAT. POST. (I-D) EAGLE 150CC III/DK FALCON SET4 AZUL', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-147A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-147N', 'PLACA LAT. POST. (I-D) EAGLE 150CC III/DK FALCON SET4 NEGRO', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-147N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-147R', 'PLACA LAT. POST. (I-D) EAGLE 150CC III/DK FALCON SET4 ROJO', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-147R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-148A', 'PLACA TANQUE (I-D) EAGLE III 18-19-20-21/DK FALCON 150cc AZUL SET4', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-148A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-148AN', 'PLACA TANQUE (I-D) EAGLE III 2022-23/DK FALCON AZUL SET4', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-148AN')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-148N', 'PLACA TANQUE (I-D) EAGLE III 18-19-20-21/DK FALCON150cc NEGRO SET4', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-148N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-148R', 'PLACA TANQUE (I-D) EAGLE III 18-19-20-21/DK FALCON150cc ROJO SET4', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-148R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-156A', 'PLACA LAT. POST. (I-D) EAGLE 3 150 2022/DK FALCON SET2 AZUL', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-156A')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-156N', 'PLACA LAT. POST. (I-D) EAGLE 3 150 2022/DK FALCON SET2 NEGRO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-156N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'CGEA150-156R', 'PLACA LAT. POST. (I-D) EAGLE 3 150 2022/DK FALCON SET2 ROJO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CGEA150-156R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-003', 'CILINDRO Y PISTON 250CC 70MM/PIN17 FE250 4V TEKKEN EVO/GP1R/XPOWER/ARTIC/GP1/FEROCE/TUKO Z250/CR5 TG/IGM VENTURE/DK NATIVA/CHIEF 2.5 250CC', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-010', 'SENSOR INDICADOR CAMBIOS FE250/300 4V TEKKEN EVO/GP1R/XPOWER/ARTIC/GP1/FEROCE/TUKO Z250/CR5 TG/IGM VENTURE/DK NATIVA/CHIEF 2.5 250/SCRAMBLER MAX 300CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-014', 'TENSOR CADENILLA FE250/300 4V TEKKEN EVO/GP1R/XPOWER/ARTIC/GP1/FEROCE/TUKO Z250/CR5 TG/IGM VENTURE/DK NATIVA/CHIEF 2.5 250/SCRAMBLER MAX 300CC', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-022', 'BOBINA CORONILLA 18M/3H FE250/300 4V TEKKEN EVO/GP1R/XPOWER/ARTIC/GP1/FEROCE/TUKO Z250/CR5 TG/IGM VENTURE/DK NATIVA/CHIEF 2.5 250CC/SCRAMBLER MAX 300CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-023', 'MOTOR ARRANQUE 9D FE250/300 4V TEKKEN EVO/GP1R/XPOWER/ARTIC/GP1/FEROCE/TUKO Z250/CR5 TG/IGM VENTURE/DK NATIVA/CHIEF 2.5 250/SCRAMBLER MAX 300CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-028', 'BOMBA ACEITE 27T FE250/300 4V TEKKEN EVO/GP1R/XPOWER/ARTIC/GP1/FEROCE/TUKO Z250/CR5 TG/IGM VENTURE/DK NATIVA/CHIEF 2.5 250/SCRAMBLER MAX 300CC', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-033', 'BOBINA BUJIA FE250', 'General', 5.3700, 10.1896
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-033')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-035', 'RODAMIENTO ARO DELANTERO 6302 RSC3 SET2 XPOWER/GP1R/CHIEF II/CHIEF II PRO 250CC', 'General', 1.9500, 3.7001
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250-036', 'RODAMIENTO ARO POSTERIOR 6303 RSC3 SET2 XPOWER/GP1R/CHIEF II/CHIEF II PRO 250CC', 'General', 1.9500, 3.7001
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-004', 'GUARDAFANGO DEL. INFERIOR ARTIC 250 B/N', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-006GV', 'PLACA LAT. POST. ARTIC 250 G-VERDE', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-006GV')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-006NR', 'PLACA LAT. POST. ARTIC 250 N-VERDE', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-006NR')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-010', 'STOP PLACA ARTIC 250', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-035', 'DISCO FRENO DEL. 4H DIN 50MM DEX265MM ARTIC 250', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-036NV', 'TANQUE GASOLINA ARTIC 250 N-VERDE', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-036NV')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-038', 'MESA DIRECCION ARMADA ARTIC 250 B/N', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-038')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-044N', 'GUARDAFANGO POST. ARTIC 250 NEGRO', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-044N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-046', 'MESA DIRECCION ARMADA ARTIC 250 B/I', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-048', 'GUARDAFANGO DEL. INFERIOR ARTIC 250 B/I', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250ART-049', 'ARO DEL. ARMADO 185X19 ARTIC 250 B/I', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250ART-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-002', 'KIT RUN Y LUCES FEROCE 250CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-005', 'CAUCHO DESLIZADOR CADENA FEROCE 250CC', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-006', 'ASIENTO SET2 FEROCE 250CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-008D', 'PLACA LAT. POST. (I-D) FEROCE 250CC N- DORADO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-008D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-008R', 'PLACA LAT. POST. (I-D) FEROCE 250CC N-ROJO', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-008R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-008V', 'PLACA LAT. POST. (I-D) FEROCE 250CC N- VERDE', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-008V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-013', 'CABLE ACELEARDOR FEROCE 250CC', 'General', 1.3400, 2.5426
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-014', 'CABLE EMBRAGUE FEROCE 250CC', 'General', 1.5400, 2.9221
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-016', 'PEDAL CAMBIOS FEROCE 250CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-020', 'FARO LED FEROCE 250CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-022', 'LUZ PLACA TANQUE SET4 FEROCE 250CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-023', 'DIRECCIONALES DEL. (I-D) FEROCE 250CC', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-024', 'CADENA 520H 110L NEGRO FEROCE 250CC', 'General', 7.7000, 14.6107
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-026D', 'ARO POST. MAGNECIO FEROCE 250CC DORADO', 'General', 60.0000, 113.8500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-026D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-026G', 'ARO POST. MAGNECIO FEROCE 250CC GRIS', 'General', 60.0000, 113.8500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-026G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-031', 'PROTEC. MOTOR TIBURON FEROCE 250CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-033', 'CUBRE CADENA FEROCE 2500CC', 'General', 7.7000, 14.6107
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-033')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-034G', 'MASCARILLA COMP. FEROCE 250CC N-GRIS', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-034G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-034R', 'MASCARILLA COMP. FEROCE 250CC N-ROJO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-034R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-035', 'ESTRIBO POST. CON BASE FEROCE 250CC', 'General', 25.7200, 48.8037
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-036', 'VELOCIMETRO DIGITAL FEROCE 250CC', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-041D', 'GUARDAFANGO DEL. FEROCE 250CC N- DORADO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-041D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250FRC-046', 'CATALINA 520H/42D FEROCE 250CC NEGRO', 'General', 10.3000, 19.5443
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250FRC-046')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250GP1R-021D', 'ARO DEL. MAGNECIO GP1-R/XPOWER/CHIEF II/CHIEF II PRO/FK370/DRAKON F300/LA BESTIA 400/SHIFT 500 DORADO', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250GP1R-021D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250GP1R-031V', 'ARO POST. MAGNECIO 4.00X17 DISCO GP1-R 250/SHM CHIEF II/CHIEF 2.5/CHIEF II PRO//THUNDER F22 250CC VERDE', 'General', 62.0000, 117.6450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250GP1R-031V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250GP1R-039', 'BASE VELOCIMETRO GP1R-250 CUADRADO 2025', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250GP1R-039')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250GP1R-040', 'BASE VELOCIMETRO GP1R-250 ANALOGO 2023', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250GP1R-040')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE250GP1R-041', 'PASTILLAS DEL SET2 GP1R 250/GP1RR 370 2026', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE250GP1R-041')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-001', 'SELECTOR CAMBIOS ARMADO SCRAMBLER MAX 300CC', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-002', 'EJE PEDAL CAMBIOS SCRAMBLER MAX 300CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-003', 'KIT EMBRAGUE ARMADO SCRAMBLER MAX 300CC', 'General', 60.0000, 113.8500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-003')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-004', 'KIT PINONES ARRANQUE SCRAMBLER MAX 300CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-006', 'CILINDRO Y PISTON SCRAMBLER MAX 300CC', 'General', 60.0000, 113.8500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-007', 'ESTRELLA Y PATINETA CAMBIOS SCRAMBLER MAX 300CC', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-008', 'BENDIX ARMADO SCRAMBLER MAX 300', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-011', 'TAPA MOTOR DER. SCRAMBLER MAX 300CC NEGRO', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-014', 'KIT EMPAQUES SCRAMBLER MAX 300CC', 'General', 10.2800, 19.5063
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-015', 'GUIA CADENILLA (1-2) SCRAMBLER MAX 300CC', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-016', 'TAPA CABEZOTE SCRAMBLER MAX 300CC', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-017', 'CARTER IZQ. SCRAMBLER MAX 300CC NEGRO', 'General', 65.0000, 123.3375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'FE300-019', 'TAPA MOTOR IZQ. SCRAMBLER MAX 300CC NEGRO', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FE300-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'ICH3110L', 'CASCO ICH3110 TALLA L', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ICH3110L')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'ICH3110XL', 'CASCO ICH3110 DV ABATIBLE NEGRO TALLA XL', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ICH3110XL')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MDY-001N', 'DRYBAG DAYTONA 6LT NEGRO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MDY-001N')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MDY-001T', 'DRYBAG DAYTONA 6LT NARANJA', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MDY-001T')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MFP-001', 'DRYBAG FP 7LT GRIS', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MFP-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-001', 'BAUL CON ESPALDAR Y BASE UNIVERSAL NEGRO 30L E-33', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-031', 'KIT BALANCIN GY200', 'General', 3.8000, 7.2105
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-031')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-040', 'CARBURADOR PZ30-11 DOBLE CABLE YOU ALL', 'General', 16.0000, 30.3600
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-040')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-049', 'PASTILLAS FRENO SHM XY150/IGM PANACHA 150/MOTOR1 FORTISIMA/FACTORY JOKER/S15/S19/TS 125 CUADRADA', 'General', 1.2000, 2.2770
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-050', 'PASTILLAS FRENO POST. FZ25/ADVR250/XR250', 'General', 1.2800, 2.4288
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-050')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-051', 'PASTILLAS FRENO GN125 UNIVERSAL', 'General', 1.2400, 2.3529
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-051')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-052', 'PASTILLAS FRENO DEL. RX250/RANGER200GY8/SHINERAY BROS/GY200 REDONDO UNIVERSAL', 'General', 1.2700, 2.4098
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-052-1', 'PASTILLAS FRENO GY200/WOLF UNIVERSAL', 'General', 1.3300, 2.5237
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-052-1')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-061', 'BOBINA CORONILLA CB200/250/RX/SCORPION/BULL/SHARKII 12M/2H 1 PULSER 5 PIN', 'General', 11.0800, 21.0243
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-061')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-063', 'CAJA CAMBIOS LEM147MM/LEP169MM SEGURO CG150/200 UNIVERSAL 5V', 'General', 19.0000, 36.0525
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-063')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-064', 'CAJA CAMBIOS LEM147MM/LEP174MM ROSCA CG150 5V UNIVERSAL', 'General', 19.0000, 36.0525
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-064')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-066', 'CAJA CAMBIOS LEM147MM/LEP176MM ROSCA SCORPION/SHARK CB250 5V', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-066')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-070', 'ESPEJOS GN125/CRUCERO150/CRUCERO200 CROMADO UNIVERSAL', 'General', 4.3600, 8.2731
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-070')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-073', 'KIT SWITCH,TAPA,LLAVES GN125 4 CABLE UNIVERSAL', 'General', 9.0000, 17.0775
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-073')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-079', 'BOBINA BUJIA UNIVERSAL LIHUA', 'General', 2.6300, 4.9904
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-079')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-084', 'KIT EMPAQUES GY6 150CC', 'General', 3.2600, 6.1858
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-084')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-086', 'RODAMIENTO 6303C3', 'General', 1.2000, 2.2770
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-086')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-097', 'BATERIA GEL 12N9-4B1 MOTOMAX', 'General', 21.2900, 40.3978
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-097')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-103', 'KIT CILINDRO CG200 D67MM/PIN16 198CC NEGRO', 'General', 27.0000, 51.2325
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-103')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-301', 'CADENA REFORZADA 428H-132L NEGRO', 'General', 4.7300, 8.9752
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-301')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-303', 'CADENA REFORZADA 520H-116L DORADO', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-303')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-304', 'KIT TRACCION CG125/GN125/CRUCERO/WING EVO/GP200/SPITFIRE 150/GTR200/SHARK II ZAPATA C45D P15D 428H-132L NEGRO', 'General', 9.7100, 18.4247
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-304')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-305', 'KIT TRACCION CG125/GN125/CRUCERO/WING EVO/GP200/SPITFIRE 150/GTR200/SHARK II ZAPATA C45D P15D 428H-132L SILVER', 'General', 9.7100, 18.4247
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-305')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-306', 'KIT TRACCION GP200/CG125/GN125/CRUCERO/WING EVO/GTR 200 C42D P15D 428H-132L NEGRO', 'General', 9.5300, 18.0832
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-306')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-307', 'KIT TRACCION GP200/CG125/GN125/CRUCERO/WING EVO/GTR 200C42D P15D 428H-132L SILVER', 'General', 9.5300, 18.0832
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-307')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-308', 'KIT TRACCION CONCOVA CG150/DELTA/PANTHER/WORKFORCE-S/STIFF/AXXO RAPTOR 150CC HONDA STORM C42D P15D 428H-132L NEGRO', 'General', 9.6400, 18.2919
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-308')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-309', 'KIT TRACCION CONCOVA CG150/DELTA/PANTHER/WORKFORCE-S/STIFF/AXXO RAPTOR 150CC C42D P15D 428H-132L SILVER', 'General', 9.6400, 18.2919
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-309')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-310', 'KIT TRACCION WORKFORCE150/CAFE RACER 150/170/EAGLE III NKD C38D P14D 428H-124L NEGRO', 'General', 8.8900, 16.8688
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-310')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-311', 'KIT TRACCION WORKFORCE150/CAFE RACER 150/170/EAGLE III NKD C38D P14D 428H-124L SILVER', 'General', 8.8900, 16.8688
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-311')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-320', 'CATALINA CONCAVA CG150/DELTA/PANTHER/WORKFORCE-S/STIFF/AXXO RAPTOR 150CC/C42D 428H NEGRO', 'General', 4.8000, 9.1080
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-320')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-321', 'CATALINA CONCAVA CG150/DELTA/PANTHER/WORKFORCE-S/STIFF/AXXO RAPTOR 150CC/C42D 428H GRIS', 'General', 4.8000, 9.1080
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-321')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMX-330', 'PINON MOTRIZ 15D/428H CG150/DELTA/PANTHER/WORKFORCE-S/STIFF/AXXO RAPTOR 150CC NEGRO', 'General', 1.0000, 1.8975
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMX-330')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMXE33V35', 'KIT BAUL MALETEROS BASE UNIVERSAL (3PCS) E33 V35', 'General', 111.6000, 211.7610
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMXE33V35')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'MMXE35V35', 'KIT BAUL MALETEROS BASE UNIVERSAL (3PCS) E35 V35', 'General', 116.0600, 220.2238
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MMXE35V35')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'POP-001', 'ROMPETRAFICO TODOMOTO EN CINTRA 40cm x 25cm', 'General', 0.0000, 0.0000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'POP-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'POP-002', 'ADHESIVOS TODOMOTO 40CMX25CM', 'General', 0.0000, 0.0000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'POP-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-001', 'CATALINA 520H/38D EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-007', 'VELOCIMETRO DIGITAL EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-008', 'BOYA GASOLINA EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-014', 'CAUCHO DESLIZADOR DE CADENA EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 3.8600, 7.3243
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-015', 'CABLE EMBRAGUE EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 2.2600, 4.2883
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-016', 'CABLE ACELERADOR EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 1.8200, 3.4534
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-018', 'KIT FRENO DEL. ARMADO EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 35.0000, 66.4125
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-018')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-019', 'DIRECCIONAL POST. SET2 EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 10.2800, 19.5063
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-019')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-020', 'STOP Y LUZ PLACA EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-020')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-021', 'TELESCOPICAS (I-D) EVEREST DUAL SPORT 300CC', 'General', 150.0000, 284.6250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-021')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-022', 'MONOSHOCK 30.5 MM EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-029', 'ESTRIBO POST. (I-D) EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 16.0000, 30.3600
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-035', 'RADIADOR ACEITE CON MANGUERAS EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 50.0000, 94.8750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-045D', 'GUARDAFANGO DEL. EVEREST DUAL SPORT 300CC N-DORADO', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-045D')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-045V', 'GUARDAFANGO DEL. EVEREST DUAL SPORT 300CC N-VERDE', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-045V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-047', 'GUARDAFANGO POST. EVEREST OFF ROAD/DUAL SPORT 300CC NEGRO', 'General', 9.0000, 17.0775
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-047')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-049G', 'TANQUE GASOLINA EVEREST OFF ROAD/DUAL SPORT 300CC N-GRIS', 'General', 55.0000, 104.3625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-049G')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-050', 'MASCARILLA COMP. EVEREST OFF ROAD/DUAL SPORT 300CC', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-050')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300EVT-052', 'ESTRIBO DEL (I-D) EVEREST 300/SHARK/BROSS 200 UNIVERSAL', 'General', 7.0000, 13.2825
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300EVT-052')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-009', 'CABLE ACELERADOR XPEDITION/TK SIKR 300', 'General', 1.4200, 2.6944
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-010', 'CABLE EMBRAGUE XPEDITION/TK SIKR 300', 'General', 1.6600, 3.1498
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-011', 'MESA DIRECCION ARMADA XPEDITION/TK SIKR 300', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-014', 'BOYA GASOLINA XPEDITION/TK SIKR 300', 'General', 3.5000, 6.6412
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-016', 'TELESCOPICAS (I-D) XPEDITION/TK SIKR 300', 'General', 150.0000, 284.6250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-017', 'MONOSHOCK XPEDITION/TK SIKR 300', 'General', 38.0000, 72.1050
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-029', 'TANQUE GASOLINA XPEDITION/TK SIKR 300', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-030', 'BASE FARO Y VELOCIMETRO XPEDITION/TK SIKR 300', 'General', 18.0000, 34.1550
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'PR300XPD-045', 'GUARDAFANGO POST. XPEDITION/TK SIKR 300', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PR300XPD-045')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-002', 'MOTOR ELECTRICO B-E ELEMENT/CITY/AGILITY', 'General', 62.2800, 118.1763
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-004', 'PINON VELOCIMETRO B-E ELEMENT/CITY', 'General', 2.0600, 3.9088
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-005', 'FARO Y MASCARILLA B-E ELEMENT VERDE', 'General', 25.0000, 47.4375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-007', 'PEDALES B-E ELEMENT/CITY', 'General', 1.2800, 2.4288
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-011', 'PORTA ZAPATAS ARMANDA DEL B-E ELEMENT/CITY', 'General', 6.5000, 12.3337
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-011')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-014', 'CABLE FRENO DEL B-E ELEMENT/CITY/AGILITY', 'General', 1.2800, 2.4288
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-015', 'GUARDAFANGO DEL B-E ELEMENT VERDE', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-016', 'GUARDAFANGO POST B-E ELEMENT VERDE', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-022', 'FARO B-E CITY', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-022')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-024', 'CABLE FRENO POST B-E ELEMENT/CITY/AGILITY', 'General', 1.5000, 2.8462
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-024')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-025', 'GUARDAFANGO DEL B-E CITY GRIS', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-026', 'GUARDAFANGO POST B-E CITY NEGRO', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-029', 'STOP B-E CITY/AGILITY', 'General', 3.6800, 6.9828
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-030', 'ESPEJOS (I-D) BICI-E/MOTO-E ELEMENT/CITY/AGILITY/DYNAMIC/SILENCE MAX', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-035', 'RUN LUCES B-E CITY/AGILITY', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-036', 'RUN LUCES B-E ELEMENT 2023', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-042', 'MANIGUETA FRENO (I-D) CON BASE ELEMENT/CITY/AGILITY NEGRO', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-042')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-047', 'FARO-VELOCIMETRO-SWITCH ELEMENT 2023', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-047')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-048', 'VELOCIMETRO CITY', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-048')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-049', 'VELOCIMETRO B/E AGILITY', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-061', 'FARO AGILITY', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-061')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-069', 'SET PLASTICOS AGILITY NEGRO', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-069')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-070', 'SET PLASTICOS AGILITY BLANCO', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-070')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-071', 'SET PLASTICOS AGILITY GRIS', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-071')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-076', 'CARGADOR 60V 17-24AH', 'General', 20.0000, 37.9500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-076')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-077', 'CATALINA B-E 32D', 'General', 4.5000, 8.5387
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-077')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-080', 'PEDAL Y BRAZOS B-E SET2', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-080')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-081', 'PORTA ZAPATA ARMANDA DEL B-E CITY 2024', 'General', 7.1800, 13.6240
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-081')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-082', 'STOP B-E CITY 2024', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-082')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RBE-083', 'VELOCIMETRO DIGITAL B-E CITY 2024', 'General', 9.6600, 18.3299
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RBE-083')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'REFRIROJOL', 'REFRIGERANTE YUKO G12+ 50/50 ROJO 1L', 'General', 6.5000, 12.3337
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'REFRIROJOL')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-001', 'CUBRE BATERIA X7', 'General', 8.4000, 15.9390
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-001')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-002', 'TIMON SET 2 ARMADO X7', 'General', 13.2000, 25.0470
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-004', 'LUZ FRONTAL X7', 'General', 4.5300, 8.5957
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-004')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-005', 'VELOCIMETRO X7', 'General', 25.1400, 47.7031
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-005')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-007', 'CODO PLEGABLE X7', 'General', 41.1600, 78.1011
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-008', 'PATA APOYO X7', 'General', 8.6100, 16.3375
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-009', 'BATERIA X7', 'General', 150.0000, 284.6250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-009')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-015', 'GUARDAFANGO POST DE FRENADO X7', 'General', 11.1300, 21.1192
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-017', 'DISCO DE FRENO X7', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-017')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-025', 'CUBRE TRINCHE (I-D) X7', 'General', 5.5500, 10.5311
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-027', 'PLACA LAT POST (I-D) X7', 'General', 4.4100, 8.3680
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-028', 'PISO SILICONE X7', 'General', 18.3300, 34.7812
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-029', 'REFLECTIVOS DELANTEROS X7', 'General', 0.4200, 0.7969
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-029')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-030', 'REFLECTIVOS POST X7', 'General', 0.4200, 0.7969
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-035', 'OSCILANTE POST X7', 'General', 1.6800, 3.1878
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-035')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RKX-036', 'PISTA DIRECCION X7', 'General', 2.8500, 5.4079
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RKX-036')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-002', 'LLANTAS 300X10 MOTOR ELECTRICA', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-002')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-008', 'DIRECCIONALES DEL SET2 SILENCE', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-015', 'APOYA PIES M-E AGLITY/DYNAMIC/SILENCE MAX', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-016', 'ARO DEL MAGNECIO MOTO ELECTRICA SILENCE MAX/DYNAMIC/AGILITY RIN 10', 'General', 23.9200, 45.3882
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-023', 'DIRECCIONALES M-E DYNAMIC/AGILITY/SILENCE MAX', 'General', 14.3400, 27.2101
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-025', 'FARO M-E AGILITY', 'General', 18.0400, 34.2309
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-025')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-026', 'FARO M-E DYNAMIC', 'General', 15.8000, 29.9805
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-026')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-027', 'FARO M-E SILENCE MAX', 'General', 18.0400, 34.2309
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-028', 'GUARDAFANGO DEL M-E AGILITY/DYNAMIC/SILENCE MAX GRIS', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-028')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-030', 'GUARDAFANGO POST INFERIOR M-E AGILITY/DYNAMIC/SILENCE MAX', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-030')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-034', 'KIT FRENO DEL ARMADO DYNAMIC/AGILITY/SILENCE MAX', 'General', 16.7400, 31.7641
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-034')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-049', 'MASCARILLA VELOCIMETRO DIRECCIONALES M-E DYNAMIC/AGILTY GRIS', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-049')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-050', 'MASCARILLA VELOCIMETRO DIRECCIONALES M-E DYNAMIC/AGILTY NEGRO', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-050')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-051', 'MASCARILLA VELOCIMETRO DIRECCIONALES M-E SILENCE MAX GRIS', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-051')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-056', 'PATA APOYO CENTRAL M-E DYNAMIC/AGILITY/SILENCE MAX', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-056')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-057', 'PATA APOYO LAT M-E DYNAMIC/AGILITY/SILENCE MAX', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-057')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-067', 'PORTA PLACAS M-E AGILITY/DYNAMIC/SILENCE MAX', 'General', 5.0000, 9.4875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-067')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-068', 'PROTEC CHASIS SWITCH M-E AGILITY/DYNAMC/SILENCE MAX', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-068')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-069', 'PROTEC CHASIS INFERIOR M-E AGILITY/DYNAMIC/SILENCE MAX', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-069')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-071', 'PUERTO USB M-E 12V', 'General', 2.5000, 4.7437
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-071')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-072', 'STOP M-E DYNAMIC/AGILITY/SILENCE MAX', 'General', 10.0000, 18.9750
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-072')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-074', 'TIMON M-E AGILITY/DYNAMIC/SILENCE MAX', 'General', 6.2400, 11.8404
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-074')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-075', 'VELOCIMETRO DIGITAL M-E AGILITY/DINAMIC', 'General', 28.7000, 54.4582
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-075')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-076', 'VELOCIMETRO DIGITAL M-E SILENCE MAX', 'General', 28.7600, 54.5721
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-076')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-077', 'ASIENTO M-E AGILITY/DYNAMIC/SILENCE MAX', 'General', 19.1400, 36.3181
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-077')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-078', 'PORTA ZAPATAS POST SILENCE', 'General', 3.8600, 7.3243
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-078')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-089', 'TIMON SILENCE', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-089')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-090', 'LUZ DECORATIVA REDONDA SILENCE', 'General', 3.0000, 5.6925
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-090')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-092', 'PROTEC CHASIS SWITCH SILENCE', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-092')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-093', 'BAUL SILENCE', 'General', 6.0000, 11.3850
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-093')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-094', 'PORTA PLACAS SILENCE', 'General', 4.0000, 7.5900
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-094')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-096', 'APOYA PIES SILENCE', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-096')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'RME-097', 'PROTEC CHASIS INFERIOR SILENCE', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'RME-097')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300-006', 'EJE BALANCEADOR ADV 300/CHIEF 30/TK CR300/RACER 300/RANGER DR300CC TY', 'General', 15.0000, 28.4625
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300-006')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300-007', 'CAJA CAMBIOS ARMADA ADV 300/CHIEF 30/TK CR300/RACER 300/RANGER DR300CC TY', 'General', 85.0000, 161.2875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300-007')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300-013', 'CDI 5 PIN CUADRADO ADVENTURE 300 TY', 'General', 8.0000, 15.1800
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300-015', 'RADIADOR ACEITE CON MANGUERAS ADVENTURE 300CC TY', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300-015')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300-016', 'TAPA MOTOR IZQ ADV 300/CHIEF 30/TK CR300/RACER 300/RANGER DR300CC TY', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300-016')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300-018', 'ARBOL LEVAS 34T ADV 300/CHIEF 30/TK CR300/RACER 300/RANGER DR300CC TY', 'General', 30.0000, 56.9250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300-018')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300-027', 'KIT PISTON ARMADO STD ADV 300/CHIEF 30/TK CR300/RACER 300/RANGER DR300CC TY', 'General', 24.0000, 45.5400
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-006R', 'GUARDAFANGO DEL ADVENTURE 300CC N- ROJO TY', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-006R')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-006V', 'GUARDAFANGO DEL ADVENTURE 300CC N- VERDE TY', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-006V')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-008', 'LUZ LED PLACA TANQUE (I-D) ADV 300CC TY', 'General', 22.0000, 41.7450
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-008')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-010', 'PORTA PLACAS ADV 300CC TY', 'General', 15.4000, 29.2215
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-010')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-012', 'VELOCIMETRO DIGITAL ADV 300CC TY', 'General', 60.0000, 113.8500
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-012')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-013', 'MONOSHOCK 330MM ADV 300/ADV 200 ROJO', 'General', 40.0000, 75.9000
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-013')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-014', 'TELESCOPICAS (I-D) ADVENTURE 300 NEGRO', 'General', 150.0000, 284.6250
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-014')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-018', 'CUBRE CADENA ADVENTURE 300 TY', 'General', 8.5000, 16.1287
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-018')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-023', 'OSCILANTE ADVENTURE 300 TY', 'General', 45.0000, 85.3875
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-023')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'TY300ADV-027', 'BASE MASCARILLA ADVENTURE 300 TY', 'General', 12.0000, 22.7700
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TY300ADV-027')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT 'YX-100', 'LLANTAS 120/70-14 YUANXING 55P/4PR', 'General', 28.0000, 53.1300
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'YX-100')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;

COMMIT;