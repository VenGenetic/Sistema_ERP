---
type: "query"
date: "2026-09-19T17:12:51.308448+00:00"
question: "en el catalgoo quiero que agregues un boton para eliminar los filtros para no tener que eliminar cada filtro, usa alguna habilidad de diseño para que quede todo bien"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Products.tsx", "MobileCatalog.tsx", "FILTER_GROUPS"]
---

# Q: en el catalgoo quiero que agregues un boton para eliminar los filtros para no tener que eliminar cada filtro, usa alguna habilidad de diseño para que quede todo bien

## Answer

Expanded from original query via graph vocab: [catalogo, mobile, filtro, filter, limpiar, clear, reset, busqueda, producto, marca, precio, stock]. The catalog filter controls are implemented in pages/Products.tsx and pages/mobile/MobileCatalog.tsx; FILTER_GROUPS defines the mobile filter groups. Added a clear-filters action that preserves search, with a persistent accessible mobile sheet-header action.

## Outcome

- Signal: useful

## Source Nodes

- Products.tsx
- MobileCatalog.tsx
- FILTER_GROUPS