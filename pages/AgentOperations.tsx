import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ServerCog,
} from "lucide-react";
import { supabase } from "../supabaseClient";

type StatusRow = {
  component_key: string;
  status: string;
  status_reason: string | null;
  last_cycle_success_at: string | null;
  last_work_completed_at: string | null;
  pending_count: number | null;
  oldest_pending_at: string | null;
  current_error: string | null;
  retry_count: number;
  next_run_at: string | null;
  blocked_dependency: string | null;
  last_probe_at: string | null;
};
type Control = {
  component_key: string;
  paused: boolean;
  pause_reason: string | null;
};
type Incident = {
  id: number;
  component_key: string;
  incident_type: string;
  status: string;
  detected_at: string;
  recovered_at: string | null;
  recovery_ms: number | null;
  action_taken: string | null;
  action_result: string | null;
};
type Report = {
  id: string;
  agent_key: string;
  period_start: string;
  period_end: string;
  generation_state: string;
  delivery_state: string;
  rendered_markdown: string | null;
  [key: string]: unknown;
};
type WeeklyConfig = {
  enabled: boolean;
  weekday: number;
  local_time: string;
  timezone: string;
  catch_up_enabled: boolean;
};

const names: Record<string, string> = {
  reception: "Recepción",
  sales: "Ventas",
  commercial: "Inteligencia Comercial",
  ia_responde: "IA RESPONDE",
  learning: "Aprendizaje",
  purchases: "Compras / pagos",
  guides: "Guías",
  whatsapp: "WhatsApp",
  outbox_sync: "Cola y sincronización",
  operational_supervisor: "Supervisor operativo",
  weekly_reports: "Reportes semanales",
  shared_infrastructure: "Infraestructura compartida",
  consolidated: "Resumen consolidado",
};
const visuals: Record<string, { label: string; dot: string; border: string }> =
  {
    available: {
      label: "Disponible",
      dot: "bg-emerald-500",
      border: "border-emerald-500/25",
    },
    working: {
      label: "Trabajando",
      dot: "bg-blue-500 animate-pulse",
      border: "border-blue-500/25",
    },
    delayed: {
      label: "Atrasado",
      dot: "bg-amber-500",
      border: "border-amber-500/30",
    },
    degraded: {
      label: "Degradado",
      dot: "bg-orange-500",
      border: "border-orange-500/30",
    },
    disconnected: {
      label: "Desconectado",
      dot: "bg-rose-500",
      border: "border-rose-500/30",
    },
    paused: {
      label: "Pausado",
      dot: "bg-slate-400",
      border: "border-slate-400/25",
    },
    intervention_required: {
      label: "Requiere intervención",
      dot: "bg-red-600",
      border: "border-red-600/40",
    },
    unknown: {
      label: "Sin evidencia",
      dot: "bg-slate-500",
      border: "border-slate-500/25",
    },
  };
const when = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("es-EC", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Guayaquil",
      }).format(new Date(v))
    : "Sin registro";
const age = (v: string | null) => {
  if (!v) return "sin fecha";
  const m = Math.max(
    0,
    Math.round((Date.now() - new Date(v).getTime()) / 60000),
  );
  return m < 60
    ? `${m} min`
    : m < 1440
      ? `${Math.round(m / 60)} h`
      : `${Math.round(m / 1440)} d`;
};
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgentOperations() {
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [schedule, setSchedule] = useState<WeeklyConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const refresh = useCallback(async () => {
    const [s, c, i, r, w] = await Promise.all([
      supabase
        .from("agent_component_status")
        .select("*")
        .order("component_key"),
      supabase
        .from("agent_component_controls")
        .select("component_key, paused, pause_reason")
        .order("component_key"),
      supabase
        .from("agent_supervisor_incidents")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(60),
      supabase
        .from("agent_weekly_reports")
        .select("*")
        .order("period_start", { ascending: false })
        .limit(40),
      supabase
        .from("agent_weekly_report_config")
        .select("enabled, weekday, local_time, timezone, catch_up_enabled")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    const e = s.error || c.error || i.error || r.error || w.error;
    if (e) setError(e.message);
    else {
      setStatuses((s.data || []) as StatusRow[]);
      setControls((c.data || []) as Control[]);
      setIncidents((i.data || []) as Incident[]);
      setReports((r.data || []) as Report[]);
      setSchedule(w.data as WeeklyConfig | null);
      setError(null);
      setRefreshed(new Date());
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 30000);
    return () => window.clearInterval(id);
  }, [refresh]);
  const controlMap = useMemo(
    () => new Map(controls.map((c) => [c.component_key, c])),
    [controls],
  );
  const active = incidents.filter((i) => i.status !== "recovered");
  const attention = statuses.filter((s) =>
    ["intervention_required", "disconnected", "delayed"].includes(s.status),
  ).length;
  const setPause = async (key: string, paused: boolean) => {
    const reason = paused
      ? window.prompt("Motivo de la pausa (obligatorio):")?.trim()
      : null;
    if (paused && !reason) return;
    const { error: e } = await supabase.rpc("agent_set_component_pause", {
      p_component_key: key,
      p_paused: paused,
      p_reason: reason,
    });
    if (e) setError(e.message);
    else void refresh();
  };
  const saveSchedule = async () => {
    if (!schedule) return;
    const { error: e } = await supabase.rpc("agent_set_weekly_report_config", {
      p_enabled: schedule.enabled,
      p_weekday: Number(schedule.weekday),
      p_local_time: schedule.local_time.slice(0, 5),
      p_timezone: schedule.timezone.trim(),
      p_catch_up_enabled: schedule.catch_up_enabled,
    });
    if (e) setError(e.message);
    else void refresh();
  };
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg px-4 py-6 text-fg sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-xl">
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.45fr_1fr] lg:px-8">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-blue-300">
                <ServerCog className="h-4 w-4" /> Sala de control ERP
              </div>
              <h1 className="text-2xl font-black sm:text-3xl">
                Operación de agentes
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Salud por función, progreso real, colas e incidentes. WhatsApp
                conectado no significa que todos los agentes funcionen.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 self-end">
              {[
                [
                  "Trabajando",
                  statuses.filter((s) => s.status === "working").length,
                ],
                ["Atención", attention],
                ["Incidentes", active.length],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="text-2xl font-black">{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-6 py-3 text-xs text-slate-400 lg:px-8">
            <span>
              Última lectura:{" "}
              {refreshed ? when(refreshed.toISOString()) : "pendiente"}
            </span>
            <button
              onClick={() => void refresh()}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Actualizar
            </button>
          </div>
        </section>
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-20 text-center text-fg-muted">
            Leyendo telemetría comprobable…
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {statuses.map((s) => {
              const v = visuals[s.status] || visuals.unknown;
              const c = controlMap.get(s.component_key);
              return (
                <article
                  key={s.component_key}
                  className={`rounded-2xl border bg-surface p-5 shadow-sm ${v.border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[.14em] text-fg-subtle">
                        {s.component_key}
                      </div>
                      <h2 className="mt-1 text-lg font-black">
                        {names[s.component_key] || s.component_key}
                      </h2>
                    </div>
                    <span className="flex items-center gap-2 rounded-full border border-subtle bg-surface-2 px-2.5 py-1 text-[11px] font-bold">
                      <span className={`h-2 w-2 rounded-full ${v.dot}`} />
                      {v.label}
                    </span>
                  </div>
                  <p className="mt-3 min-h-10 text-sm leading-5 text-fg-muted">
                    {s.status_reason || "Sin motivo registrado."}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-subtle py-4 text-xs">
                    <div>
                      <dt className="text-fg-subtle">Último ciclo</dt>
                      <dd className="mt-1 font-semibold">
                        {when(s.last_cycle_success_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-fg-subtle">Último trabajo</dt>
                      <dd className="mt-1 font-semibold">
                        {when(s.last_work_completed_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-fg-subtle">Pendientes</dt>
                      <dd className="mt-1 font-semibold">
                        {s.pending_count ?? "No medido"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-fg-subtle">Más antiguo</dt>
                      <dd className="mt-1 font-semibold">
                        {age(s.oldest_pending_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-fg-subtle">Reintentos</dt>
                      <dd className="mt-1 font-semibold">
                        {s.retry_count || 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-fg-subtle">Próxima vuelta</dt>
                      <dd className="mt-1 font-semibold">
                        {when(s.next_run_at)}
                      </dd>
                    </div>
                  </dl>
                  {(s.blocked_dependency || s.current_error) && (
                    <div className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                      {s.blocked_dependency &&
                        `Dependencia: ${s.blocked_dependency}. `}
                      {s.current_error}
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-fg-subtle">
                      Sondeo {age(s.last_probe_at)}
                    </span>
                    <button
                      onClick={() => void setPause(s.component_key, !c?.paused)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-subtle px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-hover"
                    >
                      {c?.paused ? (
                        <PlayCircle className="h-4 w-4" />
                      ) : (
                        <PauseCircle className="h-4 w-4" />
                      )}
                      {c?.paused ? "Reanudar" : "Pausar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
        <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-black">
                Incidentes y recuperaciones
              </h2>
            </div>
            <div className="space-y-3">
              {incidents.length === 0 && (
                <div className="rounded-xl border border-dashed border-subtle p-8 text-center text-sm text-fg-muted">
                  No hay incidentes registrados. Esto no prueba disponibilidad
                  anterior a la telemetría.
                </div>
              )}
              {incidents.slice(0, 16).map((i) => (
                <div
                  key={i.id}
                  className="flex gap-3 rounded-xl border border-subtle bg-surface-2 p-3"
                >
                  {i.status === "recovered" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock3 className="mt-0.5 h-4 w-4 text-amber-500" />
                  )}
                  <div>
                    <div className="text-sm font-bold">
                      {names[i.component_key] || i.component_key} · {i.status}
                    </div>
                    <div className="mt-1 text-xs text-fg-muted">
                      {i.incident_type} · {when(i.detected_at)}
                      {i.recovered_at && ` → ${when(i.recovered_at)}`}
                    </div>
                    {(i.action_taken || i.action_result) && (
                      <div className="mt-2 text-xs text-fg-muted">
                        {i.action_taken} {i.action_result}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-black">Informes semanales</h2>
            </div>
            {schedule && (
              <div className="mb-4 rounded-xl border border-subtle bg-surface-2 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-subtle">
                  Programación persistente
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <select
                    aria-label="Día del informe"
                    value={schedule.weekday}
                    onChange={(event) =>
                      setSchedule({ ...schedule, weekday: Number(event.target.value) })
                    }
                    className="rounded-lg border border-subtle bg-surface px-2 py-2"
                  >
                    {[
                      "Lunes",
                      "Martes",
                      "Miércoles",
                      "Jueves",
                      "Viernes",
                      "Sábado",
                      "Domingo",
                    ].map((day, index) => (
                      <option key={day} value={index + 1}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Hora del informe"
                    type="time"
                    value={schedule.local_time.slice(0, 5)}
                    onChange={(event) =>
                      setSchedule({ ...schedule, local_time: event.target.value })
                    }
                    className="rounded-lg border border-subtle bg-surface px-2 py-2"
                  />
                  <input
                    aria-label="Zona horaria"
                    value={schedule.timezone}
                    onChange={(event) =>
                      setSchedule({ ...schedule, timezone: event.target.value })
                    }
                    className="col-span-2 rounded-lg border border-subtle bg-surface px-2 py-2"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={(event) =>
                        setSchedule({ ...schedule, enabled: event.target.checked })
                      }
                    />
                    Generar
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={schedule.catch_up_enabled}
                      onChange={(event) =>
                        setSchedule({ ...schedule, catch_up_enabled: event.target.checked })
                      }
                    />
                    Recuperar faltante
                  </label>
                </div>
                <button
                  onClick={() => void saveSchedule()}
                  className="mt-3 cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"
                >
                  Guardar programación
                </button>
              </div>
            )}
            <div className="space-y-3">
              {reports.length === 0 && (
                <div className="rounded-xl border border-dashed border-subtle p-8 text-center text-sm text-fg-muted">
                  Aún no hay informes generados.
                </div>
              )}
              {reports.slice(0, 14).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-subtle bg-surface-2 p-3"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold">
                        {names[r.agent_key] || r.agent_key}
                      </div>
                      <div className="mt-1 text-xs text-fg-muted">
                        {when(r.period_start)} → {when(r.period_end)}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-blue-600">
                      {r.generation_state}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={!r.rendered_markdown}
                      onClick={() =>
                        download(
                          `informe-${r.agent_key}-${r.period_start.slice(0, 10)}.md`,
                          r.rendered_markdown || "",
                          "text/markdown;charset=utf-8",
                        )
                      }
                      className="flex cursor-pointer items-center gap-1 rounded-lg border border-subtle px-2.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" /> Markdown
                    </button>
                    <button
                      onClick={() =>
                        download(
                          `informe-${r.agent_key}-${r.period_start.slice(0, 10)}.json`,
                          JSON.stringify(r, null, 2),
                          "application/json;charset=utf-8",
                        )
                      }
                      className="flex cursor-pointer items-center gap-1 rounded-lg border border-subtle px-2.5 py-1.5 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" /> JSON
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
