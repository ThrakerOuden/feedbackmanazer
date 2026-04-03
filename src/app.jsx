import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  UserPlus,
  Download,
  BarChart3,
  ChevronRight,
  PhoneCall,
  Search,
  Wifi,
  Smartphone,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const STORAGE_KEY = "vodafone_naslech_app_v2";

const sections = [
  { key: "vztah", title: "Navázání vztahu", icon: PhoneCall },
  { key: "analyza", title: "Analýza potřeb", icon: Search },
  { key: "internet", title: "Fixní internet / TV", icon: Wifi },
  { key: "hardware", title: "Hardware / Příslušenství", icon: Smartphone },
  { key: "uzavreni", title: "Uzavření", icon: CheckCircle2 },
];

function generateId() {
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

function createDefaultData() {
  return {
    sellers: [
      { id: generateId(), name: "Patrik" },
      { id: generateId(), name: "Pamela" },
      { id: generateId(), name: "Martin" },
    ],
    sessions: [],
  };
}

function getSafeLocalStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    return null;
  }
  return null;
}

function loadData() {
  const storage = getSafeLocalStorage();
  const fallback = createDefaultData();

  if (!storage) return fallback;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return {
      sellers: Array.isArray(parsed && parsed.sellers) ? parsed.sellers : fallback.sellers,
      sessions: Array.isArray(parsed && parsed.sessions) ? parsed.sessions : fallback.sessions,
    };
  } catch (error) {
    return fallback;
  }
}

function saveData(data) {
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // ignore write errors
  }
}

function getRatingScore(session, key) {
  if (!session || !session.ratings || !session.ratings[key]) return 0;
  return Number(session.ratings[key].score || 0);
}

function getRatingNote(session, key) {
  if (!session || !session.ratings || !session.ratings[key]) return "";
  return session.ratings[key].note || "";
}

function formatDate(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "Neznámé datum";

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatShortDate(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "?";

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

function calcSession(session) {
  const values = sections.map(function (section) {
    return getRatingScore(session, section.key);
  });

  const sum = values.reduce(function (acc, value) {
    return acc + value;
  }, 0);

  const max = sections.length * 3;
  const percent = max > 0 ? Math.round((sum / max) * 100) : 0;

  return { sum: sum, max: max, percent: percent };
}

function sellerStats(sellerId, sessions) {
  const sellerSessions = sessions.filter(function (session) {
    return session.sellerId === sellerId;
  });

  if (!sellerSessions.length) {
    return { avgPercent: 0, count: 0, latest: null };
  }

  const percents = sellerSessions.map(function (session) {
    return calcSession(session).percent;
  });

  const avgPercent = Math.round(
    percents.reduce(function (acc, value) {
      return acc + value;
    }, 0) / percents.length
  );

  const latest = sellerSessions
    .slice()
    .sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0];

  return { avgPercent: avgPercent, count: sellerSessions.length, latest: latest };
}

function getScoreTone(percent) {
  if (percent >= 85) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (percent >= 70) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-rose-600 bg-rose-50 border-rose-200";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function exportSellerTXT(seller, sessions) {
  const sellerSessions = sessions
    .filter(function (session) {
      return session.sellerId === seller.id;
    })
    .sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const lines = [];
  lines.push("Náslechy prodejce: " + seller.name);
  lines.push("Počet náslechů: " + sellerSessions.length);
  lines.push("");

  sellerSessions.forEach(function (session, index) {
    const summary = calcSession(session);
    lines.push(index + 1 + ". " + formatDate(session.createdAt) + " | Úspěšnost: " + summary.percent + "%");

    sections.forEach(function (section) {
      const score = getRatingScore(session, section.key);
      const note = getRatingNote(session, section.key);
      lines.push("- " + section.title + ": " + (score || "-") + "/3");
      if (note) lines.push("  Poznámka: " + note);
    });

    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "naslechy-" + seller.name.toLowerCase().replace(/\s+/g, "-") + ".txt";
  a.click();
  URL.revokeObjectURL(url);
}

function printSellerToPDF(seller, sessions) {
  const sellerSessions = sessions
    .filter(function (session) {
      return session.sellerId === seller.id;
    })
    .sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const cardsHtml = sellerSessions
    .map(function (session) {
      const summary = calcSession(session);
      const sectionsHtml = sections
        .map(function (section) {
          const score = getRatingScore(session, section.key);
          const note = getRatingNote(session, section.key);
          return (
            '<div class="section">' +
            '<span class="label">' + escapeHtml(section.title) + ":</span> " +
            escapeHtml(score || "-") +
            "/3" +
            (note ? '<div>Poznámka: ' + escapeHtml(note) + "</div>" : "") +
            "</div>"
          );
        })
        .join("");

      return (
        '<div class="card">' +
        '<div class="meta">' +
        escapeHtml(formatDate(session.createdAt)) +
        " | Úspěšnost: " +
        escapeHtml(summary.percent) +
        "%</div>" +
        sectionsHtml +
        "</div>"
      );
    })
    .join("");

  const html =
    "<html><head><title>Náslechy - " +
    escapeHtml(seller.name) +
    "</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111;}h1{color:#E60000;margin-bottom:8px;}.card{border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin-bottom:16px;}.meta{color:#555;margin-bottom:10px;}.section{margin:8px 0;}.label{font-weight:700;}</style></head><body><h1>Historie náslechů – " +
    escapeHtml(seller.name) +
    "</h1><p>Počet náslechů: " +
    sellerSessions.length +
    "</p>" +
    cardsHtml +
    "</body></html>";

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(function () {
    w.print();
  }, 300);
}

function createInitialRatings() {
  const result = {};
  sections.forEach(function (section) {
    result[section.key] = { score: 2, note: "" };
  });
  return result;
}

function runSelfTests() {
  const testSessionAllThrees = {
    ratings: {
      vztah: { score: 3, note: "" },
      analyza: { score: 3, note: "" },
      internet: { score: 3, note: "" },
      hardware: { score: 3, note: "" },
      uzavreni: { score: 3, note: "" },
    },
  };

  const testSessionMixed = {
    ratings: {
      vztah: { score: 1, note: "" },
      analyza: { score: 2, note: "" },
      internet: { score: 3, note: "" },
      hardware: { score: 1, note: "" },
      uzavreni: { score: 2, note: "" },
    },
  };

  const resultA = calcSession(testSessionAllThrees);
  const resultB = calcSession(testSessionMixed);
  const stats = sellerStats("seller-1", [
    { sellerId: "seller-1", createdAt: "2026-04-01T10:00:00.000Z", ratings: testSessionAllThrees.ratings },
    { sellerId: "seller-1", createdAt: "2026-04-02T10:00:00.000Z", ratings: testSessionMixed.ratings },
  ]);

  console.assert(resultA.percent === 100, "Self-test failed: full score should be 100%.");
  console.assert(resultB.sum === 9, "Self-test failed: mixed session sum should be 9.");
  console.assert(stats.count === 2, "Self-test failed: seller stats count should be 2.");
  console.assert(stats.latest && stats.latest.createdAt === "2026-04-02T10:00:00.000Z", "Self-test failed: latest session mismatch.");
}

if (typeof window !== "undefined") {
  runSelfTests();
}

function StatCard(props) {
  const title = props.title;
  const value = props.value;
  const hint = props.hint;
  const tone = props.tone || "default";

  const tones = {
    default: "bg-white border-white/60",
    red: "bg-gradient-to-br from-[#E60000] to-[#b90000] text-white border-transparent",
    soft: "bg-slate-50 border-slate-200",
  };

  return (
    <div className={"rounded-3xl border p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)] " + tones[tone]}>
      <div className="text-sm opacity-70">{title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-2 text-sm opacity-70">{hint}</div> : null}
    </div>
  );
}

function SellerCard(props) {
  const seller = props.seller;
  const stats = props.stats;
  const onOpen = props.onOpen;
  const onDelete = props.onDelete;

  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:border-slate-300"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-slate-900">{seller.name}</div>
          <div className="mt-1 text-sm text-slate-500">Počet náslechů: {stats.count}</div>
        </div>

        <div className="flex items-center gap-2">
          <span className={"rounded-full border px-3 py-1 text-sm font-medium " + getScoreTone(stats.avgPercent)}>
            {stats.avgPercent}%
          </span>
          <span
            onClick={function (e) {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
            role="button"
            tabIndex={0}
          >
            <Trash2 className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
        <span>Poslední náslech: {stats.latest ? formatDate(stats.latest.createdAt) : "zatím žádný"}</span>
        <span className="flex items-center gap-1 font-medium text-slate-800">
          Detail <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

function AddSellerModal(props) {
  const open = props.open;
  const onClose = props.onClose;
  const onAdd = props.onAdd;
  const [name, setName] = useState("");

  useEffect(
    function () {
      if (!open) setName("");
    },
    [open]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Přidat prodejce</h3>
            <p className="mt-1 text-sm text-slate-500">Nový člen se ihned zobrazí na dashboardu.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          value={name}
          onChange={function (e) {
            setName(e.target.value);
          }}
          placeholder="Např. Patrik Novák"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#E60000]"
        />

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Zrušit
          </button>
          <button
            onClick={function () {
              if (!name.trim()) return;
              onAdd(name.trim());
              onClose();
            }}
            className="flex-1 rounded-2xl bg-[#E60000] px-4 py-3 font-medium text-white hover:bg-[#c50000]"
          >
            Přidat
          </button>
        </div>
      </div>
    </div>
  );
}

function NewSessionModal(props) {
  const open = props.open;
  const onClose = props.onClose;
  const sellers = props.sellers;
  const onSave = props.onSave;
  const preselectedSellerId = props.preselectedSellerId;

  const [sellerId, setSellerId] = useState(preselectedSellerId || (sellers[0] ? sellers[0].id : ""));
  const [ratings, setRatings] = useState(createInitialRatings());

  useEffect(
    function () {
      if (open) {
        setSellerId(preselectedSellerId || (sellers[0] ? sellers[0].id : ""));
        setRatings(createInitialRatings());
      }
    },
    [open, preselectedSellerId, sellers]
  );

  if (!open) return null;

  const currentPercent = calcSession({ ratings: ratings }).percent;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
      <div className="mx-auto mt-4 max-w-4xl rounded-[28px] bg-white p-5 shadow-2xl sm:mt-10 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Nový náslech</h3>
            <p className="mt-1 text-sm text-slate-500">Vyplň hodnocení a ulož výsledek do historie.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Prodejce</label>
            <select
              value={sellerId}
              onChange={function (e) {
                setSellerId(e.target.value);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#E60000]"
            >
              {sellers.map(function (seller) {
                return (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="rounded-3xl border border-[#ffd7d7] bg-[#fff5f5] px-5 py-4">
            <div className="text-sm text-slate-600">Aktuální úspěšnost</div>
            <div className="mt-1 text-3xl font-semibold text-[#E60000]">{currentPercent}%</div>
          </div>
        </div>

        <div className="space-y-4">
          {sections.map(function (section) {
            const Icon = section.icon;
            const scoreValue = ratings[section.key] ? ratings[section.key].score : 2;
            const noteValue = ratings[section.key] ? ratings[section.key].note : "";

            return (
              <div key={section.key} className="rounded-3xl border border-slate-200 p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{section.title}</div>
                    <div className="text-sm text-slate-500">Hodnocení 1 = slabé, 3 = výborné</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-700">Skóre</div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(function (score) {
                        const active = scoreValue === score;
                        return (
                          <button
                            key={score}
                            type="button"
                            onClick={function () {
                              setRatings(function (prev) {
                                return {
                                  ...prev,
                                  [section.key]: { ...(prev[section.key] || {}), score: score },
                                };
                              });
                            }}
                            className={
                              "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition " +
                              (active
                                ? "border-[#E60000] bg-[#E60000] text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                            }
                          >
                            {score}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-700">Poznámka</div>
                    <textarea
                      rows={3}
                      value={noteValue}
                      onChange={function (e) {
                        const nextValue = e.target.value;
                        setRatings(function (prev) {
                          return {
                            ...prev,
                            [section.key]: { ...(prev[section.key] || {}), note: nextValue },
                          };
                        });
                      }}
                      placeholder="Krátká zpětná vazba k této sekci..."
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#E60000]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Zrušit
          </button>
          <button
            onClick={function () {
              if (!sellerId) return;
              onSave({
                id: generateId(),
                sellerId: sellerId,
                createdAt: new Date().toISOString(),
                ratings: ratings,
              });
              onClose();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#E60000] px-5 py-3 font-medium text-white hover:bg-[#c50000]"
          >
            <Save className="h-4 w-4" />
            Uložit náslech
          </button>
        </div>
      </div>
    </div>
  );
}

function SellerDetail(props) {
  const seller = props.seller;
  const sessions = props.sessions;
  const onBack = props.onBack;

  const sellerSessions = useMemo(
    function () {
      return sessions
        .filter(function (session) {
          return session.sellerId === seller.id;
        })
        .slice()
        .sort(function (a, b) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    },
    [seller.id, sessions]
  );

  const chartData = sellerSessions.map(function (session, index) {
    return {
      index: index + 1,
      date: formatShortDate(session.createdAt),
      percent: calcSession(session).percent,
    };
  });

  const avg = sellerStats(seller.id, sessions).avgPercent;
  const latestPercent = sellerSessions.length
    ? calcSession(sellerSessions[sellerSessions.length - 1]).percent
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button onClick={onBack} className="mb-3 text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Zpět na dashboard
          </button>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{seller.name}</h2>
          <p className="mt-1 text-slate-500">Detail výkonu, historie a trend v čase.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={function () {
              exportSellerTXT(seller, sessions);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export TXT
          </button>
          <button
            onClick={function () {
              printSellerToPDF(seller, sessions);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#E60000] px-4 py-3 font-medium text-white hover:bg-[#c50000]"
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Průměrné skóre" value={avg + "%"} tone="red" />
        <StatCard title="Počet náslechů" value={sellerSessions.length} tone="soft" />
        <StatCard title="Poslední výsledek" value={latestPercent === null ? "—" : latestPercent + "%"} tone="soft" />
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#E60000]" />
          <h3 className="text-lg font-semibold text-slate-900">Vývoj v čase</h3>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="percent" name="Úspěšnost %" stroke="#E60000" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Historie náslechů</h3>

        {!sellerSessions.length ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            Zatím zde nejsou žádné náslechy.
          </div>
        ) : (
          <div className="space-y-4">
            {sellerSessions
              .slice()
              .reverse()
              .map(function (session) {
                const summary = calcSession(session);

                return (
                  <div key={session.id} className="rounded-3xl border border-slate-200 p-4 sm:p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{formatDate(session.createdAt)}</div>
                        <div className="text-sm text-slate-500">Souhrn hodnocení po sekcích</div>
                      </div>
                      <div className={"rounded-full border px-3 py-1 text-sm font-semibold " + getScoreTone(summary.percent)}>
                        {summary.percent}%
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {sections.map(function (section) {
                        const score = getRatingScore(session, section.key);
                        const note = getRatingNote(session, section.key);

                        return (
                          <div key={section.key} className="rounded-2xl bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-slate-800">{section.title}</span>
                              <span className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                                {score || "-"}/3
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{note || "Bez poznámky."}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(function () {
    return loadData();
  });
  const [addSellerOpen, setAddSellerOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState(null);
  const [preselectedForSession, setPreselectedForSession] = useState(null);

  useEffect(
    function () {
      saveData(data);
    },
    [data]
  );

  const sellersRanked = useMemo(
    function () {
      return data.sellers
        .slice()
        .map(function (seller) {
          return { seller: seller, stats: sellerStats(seller.id, data.sessions) };
        })
        .sort(function (a, b) {
          return b.stats.avgPercent - a.stats.avgPercent;
        });
    },
    [data.sellers, data.sessions]
  );

  const totalSessions = data.sessions.length;
  const overallAvg = sellersRanked.length
    ? Math.round(
        sellersRanked.reduce(function (sum, item) {
          return sum + item.stats.avgPercent;
        }, 0) / sellersRanked.length
      )
    : 0;

  const selectedSeller = data.sellers.find(function (seller) {
    return seller.id === selectedSellerId;
  });

  function handleAddSeller(name) {
    setData(function (prev) {
      return {
        ...prev,
        sellers: prev.sellers.concat([{ id: generateId(), name: name }]),
      };
    });
  }

  function handleDeleteSeller(sellerId) {
    const seller = data.sellers.find(function (item) {
      return item.id === sellerId;
    });

    const confirmed = window.confirm(
      "Opravdu chceš smazat prodejce " + (seller ? seller.name : "") + "? Smažou se i všechny jeho náslechy."
    );

    if (!confirmed) return;

    setData(function (prev) {
      return {
        sellers: prev.sellers.filter(function (item) {
          return item.id !== sellerId;
        }),
        sessions: prev.sessions.filter(function (session) {
          return session.sellerId !== sellerId;
        }),
      };
    });

    if (selectedSellerId === sellerId) setSelectedSellerId(null);
  }

  function handleSaveSession(session) {
    setData(function (prev) {
      return {
        ...prev,
        sessions: prev.sessions.concat([session]),
      };
    });
    setSelectedSellerId(session.sellerId);
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[32px] bg-gradient-to-r from-[#111111] via-[#1a1a1a] to-[#222222] p-6 text-white shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/80">
                Vodafone Manager Tool
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Náslechy prodejních dovedností</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
                Minimalistická aplikace pro rychlé hodnocení, přehled trendu a práci s rozvojem prodejců.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={function () {
                  setAddSellerOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-medium text-white backdrop-blur hover:bg-white/15"
              >
                <UserPlus className="h-4 w-4" />
                Přidat prodejce
              </button>
              <button
                onClick={function () {
                  setPreselectedForSession(null);
                  setNewSessionOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#E60000] px-4 py-3 font-medium text-white hover:bg-[#c50000]"
              >
                <Plus className="h-4 w-4" />
                Nový náslech
              </button>
            </div>
          </div>
        </header>

        {selectedSeller ? (
          <SellerDetail
            seller={selectedSeller}
            sessions={data.sessions}
            onBack={function () {
              setSelectedSellerId(null);
            }}
          />
        ) : (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-3">
              <StatCard title="Počet prodejců" value={data.sellers.length} hint="Aktivní členové týmu" />
              <StatCard title="Počet náslechů" value={totalSessions} hint="Celkem uložených hodnocení" tone="soft" />
              <StatCard title="Průměr týmu" value={overallAvg + "%"} hint="Napříč všemi prodejci" tone="red" />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard prodejců</h2>
                  <p className="mt-1 text-sm text-slate-500">Kliknutím otevřeš detail vývoje konkrétního prodejce.</p>
                </div>
                <button
                  onClick={function () {
                    setPreselectedForSession(null);
                    setNewSessionOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#E60000] px-4 py-3 font-medium text-white hover:bg-[#c50000]"
                >
                  <Plus className="h-4 w-4" />
                  Nový náslech
                </button>
              </div>

              {!sellersRanked.length ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                    <UserPlus className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Zatím tu nikdo není</h3>
                  <p className="mt-2 text-sm text-slate-500">Přidej prvního prodejce a začni s náslechy.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {sellersRanked.map(function (item) {
                    return (
                      <div key={item.seller.id} className="space-y-3">
                        <SellerCard
                          seller={item.seller}
                          stats={item.stats}
                          onOpen={function () {
                            setSelectedSellerId(item.seller.id);
                          }}
                          onDelete={function () {
                            handleDeleteSeller(item.seller.id);
                          }}
                        />
                        <button
                          onClick={function () {
                            setPreselectedForSession(item.seller.id);
                            setNewSessionOpen(true);
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Nový náslech pro {item.seller.name}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <AddSellerModal
        open={addSellerOpen}
        onClose={function () {
          setAddSellerOpen(false);
        }}
        onAdd={handleAddSeller}
      />

      <NewSessionModal
        open={newSessionOpen}
        onClose={function () {
          setNewSessionOpen(false);
        }}
        sellers={data.sellers}
        onSave={handleSaveSession}
        preselectedSellerId={preselectedForSession}
      />
    </div>
  );
}
