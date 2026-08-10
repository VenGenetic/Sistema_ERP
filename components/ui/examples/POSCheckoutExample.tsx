/**
 * ============================================================================
 *  EJEMPLO DE REFERENCIA — Vista de POS con el sistema de diseño
 * ============================================================================
 *
 * Archivo de referencia, no está enrutado ni se incluye en el bundle (Vite solo
 * empaqueta lo que se importa). Sirve para copiar la estructura al migrar
 * `pages/POS.tsx`.
 *
 * Muestra cómo se combinan las piezas:
 *   - `page.*`   → rejilla y cabecera
 *   - `table.*`  → carrito con columnas numéricas alineadas
 *   - `stat.*`   → total a cobrar
 *   - primitivas `Button` / `Input` / `Badge` / `Modal`
 *
 * Las decisiones de UX que trae incorporadas están comentadas en su sitio con
 * el prefijo «UX:». Son las que más reducen el tiempo por venta en mostrador.
 */

import React from 'react';
import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Badge, Button, Input, Modal, StockBadge } from '../index';
import { cn, kbd, page, stat, table as t } from '../styles';

/* -------------------------------------------------------------------------- */
/*  Datos de ejemplo                                                           */
/* -------------------------------------------------------------------------- */

interface CartLine {
  id: number;
  name: string;
  sku: string;
  qty: number;
  price: number;
  stock: number;
}

const money = (value: number) =>
  value.toLocaleString('es-EC', { style: 'currency', currency: 'USD' });

/* -------------------------------------------------------------------------- */
/*  Vista                                                                      */
/* -------------------------------------------------------------------------- */

export const POSCheckoutExample: React.FC = () => {
  const [lines, setLines] = React.useState<CartLine[]>([
    { id: 1, name: 'Amortiguador delantero Aveo', sku: 'AMO-AVE-01', qty: 2, price: 42.5, stock: 14 },
    { id: 2, name: 'Filtro de aceite Spark GT', sku: 'FIL-SPK-03', qty: 1, price: 8.9, stock: 3 },
    { id: 3, name: 'Pastillas de freno Sail', sku: 'PAS-SAI-11', qty: 1, price: 31.0, stock: 0 },
  ]);
  const [isPaymentOpen, setPaymentOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  /*
   * UX: el foco vive en el buscador.
   * El cajero nunca debería tener que tomar el ratón para agregar un artículo.
   * F2 devuelve el foco al buscador desde cualquier punto, y tras cada línea
   * agregada el input se limpia y se vuelve a enfocar solo.
   */
  React.useEffect(() => {
    searchRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      // UX: F12 cobra sin soltar el teclado. Solo si hay algo que cobrar.
      if (event.key === 'F12' && lines.length > 0) {
        event.preventDefault();
        setPaymentOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lines.length]);

  const updateQty = (id: number, delta: number) =>
    setLines((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, qty: Math.max(1, line.qty + delta) } : line,
      ),
    );

  return (
    <div className="flex h-screen flex-col bg-bg text-fg">
      {/* ---------------------------------------------------------------- */}
      {/*  Barra superior: cliente + estado de caja                          */}
      {/* ---------------------------------------------------------------- */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-subtle bg-surface px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" icon={<UserRound size={15} />}>
            Consumidor Final
          </Button>
          <Badge tone="info" dot size="sm">
            Caja abierta
          </Badge>
        </div>

        <span className="text-xs text-fg-muted">
          Cobrar <span className={kbd}>F12</span>
          <span className="mx-2 text-fg-subtle">·</span>
          Buscar <span className={kbd}>F2</span>
        </span>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* ================================================================ */}
        {/*  Izquierda: búsqueda + carrito                                    */}
        {/* ================================================================ */}
        <section className="flex flex-1 flex-col gap-4 overflow-hidden p-4 md:p-6">
          {/*
            UX: un único campo de entrada, grande y siempre enfocado.
            Acepta indistintamente el código escaneado, el SKU o el nombre —
            el cajero no elige "modo de búsqueda", solo escribe o escanea.
          */}
          <Input
            ref={searchRef}
            label="Buscar o escanear producto"
            hideLabel
            inputSize="xl"
            placeholder="Escanea el código o escribe SKU / nombre…"
            leadingIcon={<Search size={18} />}
            className="shadow-sm"
          />

          {/* ---------------- Carrito ---------------- */}
          <div className={cn(t.wrapper, 'flex min-h-0 flex-1 flex-col')}>
            <div className={cn(t.scroll, 'flex-1 overflow-y-auto')}>
              <table className={t.root}>
                <thead className={t.thead}>
                  <tr>
                    <th scope="col" className={t.th}>Producto</th>
                    <th scope="col" className={cn(t.th, 'text-center')}>Cant.</th>
                    <th scope="col" className={cn(t.th, 'text-right')}>P. Unit.</th>
                    <th scope="col" className={cn(t.th, 'text-right')}>Importe</th>
                    <th scope="col" className={cn(t.th, 'w-12')}>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>

                <tbody className={t.tbody}>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={t.empty}>
                        Escanea un producto para empezar la venta.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <tr key={line.id} className={t.tr}>
                        {/* Texto a la izquierda; dato principal arriba, apoyo debajo */}
                        <td className={t.td}>
                          <div className="flex flex-col">
                            <span className={t.tdPrimary}>{line.name}</span>
                            <span className="text-xs text-fg-muted tnum">{line.sku}</span>
                          </div>
                        </td>

                        {/*
                          UX: +/- de 32px con el número entre medio.
                          Ajustar de 1 en 1 es lo más frecuente; teclear la
                          cantidad exacta sigue disponible al hacer clic.
                        */}
                        <td className={cn(t.td, 'text-center')}>
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              aria-label={`Quitar una unidad de ${line.name}`}
                              onClick={() => updateQty(line.id, -1)}
                              icon={<Minus size={14} />}
                            />
                            <span className="w-8 text-center text-sm font-semibold tnum">
                              {line.qty}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              aria-label={`Añadir una unidad de ${line.name}`}
                              onClick={() => updateQty(line.id, 1)}
                              icon={<Plus size={14} />}
                            />
                          </div>
                          {/* Aviso de stock junto a la cantidad, donde se decide */}
                          {line.stock <= 5 && (
                            <div className="mt-1">
                              <StockBadge qty={line.stock} size="sm" showLabel />
                            </div>
                          )}
                        </td>

                        {/* Números: siempre a la derecha y con cifras tabulares */}
                        <td className={cn(t.td, t.num, t.tdMuted)}>{money(line.price)}</td>
                        <td className={cn(t.td, t.numStrong)}>{money(line.qty * line.price)}</td>

                        <td className={cn(t.td, 'text-right')}>
                          <Button
                            variant="dangerGhost"
                            size="sm"
                            iconOnly
                            aria-label={`Eliminar ${line.name} del carrito`}
                            onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                            icon={<Trash2 size={14} />}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/*  Derecha: totales y cobro                                         */}
        {/* ================================================================ */}
        <aside className="flex w-full shrink-0 flex-col gap-4 border-t border-subtle bg-surface p-4 md:p-6 lg:w-80 lg:border-l lg:border-t-0 xl:w-96">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-fg-muted">
              <span>Subtotal</span>
              <span className="tnum">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-fg-muted">
              <span>IVA (15%)</span>
              <span className="tnum">{money(tax)}</span>
            </div>
          </div>

          <div className={page.divider} />

          {/*
            UX: el total es el elemento más grande de la pantalla.
            Es el único número que el cajero lee en voz alta, y el que el
            cliente busca al mirar el monitor.
          */}
          <div>
            <span className={stat.label}>Total a cobrar</span>
            <p className={cn(stat.valueLg, 'mt-1')}>{money(total)}</p>
            <p className={cn(stat.meta, 'mt-1')}>
              {lines.length} {lines.length === 1 ? 'artículo' : 'artículos'}
            </p>
          </div>

          <div className="mt-auto space-y-2">
            {/*
              UX: una sola acción primaria, a lo ancho y de 48px de alto.
              Imposible de fallar con el ratón y cumple el mínimo táctil en
              pantallas de mostrador.
            */}
            <Button
              variant="success"
              size="xl"
              fullWidth
              disabled={lines.length === 0}
              onClick={() => setPaymentOpen(true)}
              icon={<Banknote size={18} />}
            >
              Cobrar {money(total)}
            </Button>

            <Button
              variant="ghost"
              size="md"
              fullWidth
              disabled={lines.length === 0}
              onClick={() => setLines([])}
            >
              Vaciar carrito
            </Button>
          </div>
        </aside>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Modal de cobro                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Registrar cobro"
        subtitle={`Total ${money(total)}`}
        width="sm"
        /* UX: un cobro a medio registrar no debe cerrarse por un clic fuera. */
        dismissOnOverlay={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaymentOpen(false)}>
              Cancelar
            </Button>
            <Button variant="success" icon={<Banknote size={16} />}>
              Confirmar cobro
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* UX: método de pago como botones grandes, no como <select>.
              Un clic en vez de tres, y se ve cuál está activo. */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="lg" icon={<Banknote size={16} />}>
              Efectivo
            </Button>
            <Button variant="secondary" size="lg" icon={<CreditCard size={16} />}>
              Tarjeta
            </Button>
          </div>

          <Input
            label="Efectivo recibido"
            inputSize="xl"
            numeric
            type="number"
            step="0.01"
            defaultValue={total.toFixed(2)}
            hint="Se preselecciona el importe exacto: pulsa Enter si el pago es justo."
          />

          <div className="rounded-lg border border-subtle bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-fg-muted">Cambio</span>
              <span className="text-xl font-bold tnum text-success">{money(0)}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default POSCheckoutExample;
