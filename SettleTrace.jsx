import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  LayoutDashboard, ListChecks, RefreshCw, BrainCircuit, ScrollText, Settings as SettingsIcon,
  Search, ChevronLeft, ChevronRight, X, CheckCircle2, AlertTriangle, ShieldAlert, ShieldCheck,
  ShieldQuestion, Loader2, ArrowUpDown, Menu, LogIn, Circle, XCircle
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

/* ---------------------------------------------------------------------- */
/* Formatting helpers                                                      */
/* ---------------------------------------------------------------------- */

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Math.round(n || 0)
  );

const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/* ---------------------------------------------------------------------- */
/* Seeded RNG so the demo dataset is stable across renders                 */
/* ---------------------------------------------------------------------- */

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "Ananya Rao", "Vikram Iyer", "Priya Nair", "Rohit Sharma", "Sneha Menon", "Arjun Patel",
  "Kavya Reddy", "Aditya Kulkarni", "Meera Pillai", "Karthik Subramaniam", "Isha Gupta",
  "Rahul Verma", "Divya Krishnan", "Nikhil Joshi", "Pooja Desai", "Sanjay Bhatt",
  "Lakshmi Narayanan", "Farhan Ansari", "Ritu Chawla", "Manoj Tiwari",
];
const METHODS = ["UPI", "Card", "NetBanking", "Wallet"];

const EXC_TYPES = {
  AMOUNT_MISMATCH: "Amount Mismatch",
  MISSING_SETTLEMENT: "Missing Settlement",
  REFUND_ADJUSTMENT: "Refund Adjustment",
  FEE_TAX_VARIANCE: "Fee / Tax Variance",
  SETTLEMENT_DELAY: "Settlement Delay",
  DUPLICATE_RECORD: "Duplicate Record",
};

/* ---------------------------------------------------------------------- */
/* Demo data generation — pure function, no hardcoded totals               */
/* ---------------------------------------------------------------------- */

function generateTransactions() {
  const rnd = mulberry32(20260904);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const baseDate = new Date("2026-08-25T09:00:00+05:30");

  // 1-based transaction numbers that will carry an exception, mapped to a type.
  const exceptionPlan = {
    8: "AMOUNT_MISMATCH",
    15: "MISSING_SETTLEMENT",
    22: "REFUND_ADJUSTMENT",
    29: "SETTLEMENT_DELAY",
    36: "FEE_TAX_VARIANCE",
    42: "FEE_TAX_VARIANCE", // guaranteed demo scenario A -> TXN_10042
    47: "AMOUNT_MISMATCH",
    51: "DUPLICATE_RECORD", // guaranteed demo scenario C
    54: "MISSING_SETTLEMENT",
    58: "REFUND_ADJUSTMENT",
    61: "SETTLEMENT_DELAY",
    64: "FEE_TAX_VARIANCE",
    66: "AMOUNT_MISMATCH",
    68: "AMOUNT_MISMATCH", // guaranteed demo scenario B -> TXN_10068
  };

  const txns = [];
  for (let i = 1; i <= 68; i++) {
    const id = `TXN_${10000 + i}`;
    const customer = pick(NAMES);
    const method = pick(METHODS);
    const daysAgo = 68 - i;
    const timestamp = new Date(baseDate.getTime() - daysAgo * 3600 * 1000 * 6).toISOString();

    let amount, feeRate = 0.02, fee, tax = 0, refund = 0, adjustment = 0;
    let actualSettlement, duplicateOf = null, delayDays = 0;

    if (i === 42) {
      // Scenario A — low risk, fee/tax variance
      amount = 4999;
      fee = 99;
      const expected = amount - fee - tax - refund + adjustment;
      actualSettlement = expected - 42;
    } else if (i === 68) {
      // Scenario B — high value, needs human review
      amount = 25000;
      fee = 500;
      const expected = amount - fee - tax - refund + adjustment;
      actualSettlement = expected - 4800;
    } else if (i === 51) {
      // Scenario C — duplicate, blocked
      amount = 12000;
      fee = 240;
      const expected = amount - fee - tax - refund + adjustment;
      actualSettlement = expected + amount; // settled twice
      duplicateOf = "TXN_10050";
    } else {
      amount = Math.round((500 + rnd() * 29000) / 10) * 10;
      fee = Math.round(amount * feeRate);
      const kind = exceptionPlan[i];

      if (!kind) {
        // matched
        const expected = amount - fee - tax - refund + adjustment;
        actualSettlement = expected;
      } else if (kind === "AMOUNT_MISMATCH") {
        const expected = amount - fee - tax - refund + adjustment;
        const variance = Math.round(amount * (0.06 + rnd() * 0.1));
        actualSettlement = expected - variance;
      } else if (kind === "MISSING_SETTLEMENT") {
        actualSettlement = null;
      } else if (kind === "REFUND_ADJUSTMENT") {
        refund = Math.round(amount * (0.1 + rnd() * 0.2));
        const expected = amount - fee - tax - refund + adjustment;
        actualSettlement = expected; // matches once refund is accounted for on paper, but not yet reflected in ledger below
        actualSettlement = expected + refund; // ledger hasn't applied the refund yet -> variance == refund
      } else if (kind === "FEE_TAX_VARIANCE") {
        const expected = amount - fee - tax - refund + adjustment;
        const variance = Math.round(20 + rnd() * 110);
        actualSettlement = expected - variance;
      } else if (kind === "SETTLEMENT_DELAY") {
        delayDays = 2 + Math.floor(rnd() * 4);
        const expected = amount - fee - tax - refund + adjustment;
        actualSettlement = null; // not yet settled, pending next cycle
      } else if (kind === "DUPLICATE_RECORD") {
        const expected = amount - fee - tax - refund + adjustment;
        actualSettlement = expected + amount;
        duplicateOf = `TXN_${10000 + i - 1}`;
      }
    }

    txns.push({
      id,
      customer,
      method,
      timestamp,
      amount,
      fee,
      tax,
      refund,
      adjustment,
      actualSettlement,
      duplicateOf,
      delayDays,
      settlementId: actualSettlement === null ? null : `STL_${20000 + i}`,
    });
  }
  return txns;
}

/* ---------------------------------------------------------------------- */
/* Deterministic reconciliation engine                                     */
/* ---------------------------------------------------------------------- */

function classifyException(txn, expected, variance) {
  if (txn.duplicateOf) return "DUPLICATE_RECORD";
  if (txn.actualSettlement === null && txn.delayDays > 0) return "SETTLEMENT_DELAY";
  if (txn.actualSettlement === null) return "MISSING_SETTLEMENT";
  if (txn.refund > 0 && Math.abs(variance - txn.refund) < 1) return "REFUND_ADJUSTMENT";
  if (Math.abs(variance) <= 150) return "FEE_TAX_VARIANCE";
  return "AMOUNT_MISMATCH";
}

function severityFor(type, variance, amount) {
  if (type === "DUPLICATE_RECORD") return "critical";
  const ratio = amount ? Math.abs(variance) / amount : 0;
  if (type === "FEE_TAX_VARIANCE" || type === "REFUND_ADJUSTMENT") return "low";
  if (type === "SETTLEMENT_DELAY") return "medium";
  if (ratio >= 0.15 || Math.abs(variance) >= 4000) return "high";
  if (ratio >= 0.05) return "medium";
  return "low";
}

function reconcile(transactions) {
  const records = transactions.map((txn) => {
    const expected = txn.amount - txn.fee - txn.tax - txn.refund + txn.adjustment;
    const actual = txn.actualSettlement;
    const variance = actual === null ? expected : Math.round(expected - actual);
    const isMatched = actual !== null && Math.abs(variance) < 1 && !txn.duplicateOf;
    let type = null;
    if (!isMatched) type = classifyException(txn, expected, variance);
    return {
      txn,
      expected,
      actual,
      variance,
      matched: isMatched,
      type,
      severity: isMatched ? null : severityFor(type, variance, txn.amount),
    };
  });
  const matched = records.filter((r) => r.matched);
  const exceptions = records.filter((r) => !r.matched);
  return { records, matched, exceptions };
}

/* ---------------------------------------------------------------------- */
/* Rule-based AI investigation layer (deterministic fallback)              */
/* ---------------------------------------------------------------------- */

function investigate(record) {
  const { txn, variance, type } = record;
  const v = Math.abs(variance);
  let confidence, rootCause, recommendedAction, aiReview;

  switch (type) {
    case "FEE_TAX_VARIANCE":
      confidence = v <= 50 ? 94 : v <= 150 ? 90 : 84;
      rootCause = `Settlement is ${inr(v)} lower than expected due to a fee/tax adjustment on this transaction.`;
      recommendedAction = "Mark as Expected Adjustment";
      aiReview = confidence < 90;
      break;
    case "REFUND_ADJUSTMENT":
      confidence = 92;
      rootCause = `The ${inr(txn.refund)} variance matches a processed refund that has not yet been reflected in the settlement ledger.`;
      recommendedAction = "Mark as Expected Adjustment";
      aiReview = false;
      break;
    case "SETTLEMENT_DELAY":
      confidence = 85;
      rootCause = `No settlement record exists yet; the payment is pending and expected to settle in ${txn.delayDays} day(s) on the next cycle.`;
      recommendedAction = "Request Settlement Review";
      aiReview = false;
      break;
    case "MISSING_SETTLEMENT":
      confidence = 58;
      rootCause = "No matching settlement record was found for this payment. This may indicate a failed, delayed, or unrecorded settlement.";
      recommendedAction = "Request Settlement Review";
      aiReview = true;
      break;
    case "AMOUNT_MISMATCH": {
      const ratio = v / txn.amount;
      confidence = ratio < 0.1 ? 82 : ratio < 0.2 ? 76 : 62;
      rootCause = `Settlement amount differs from the expected value by ${inr(v)}, with no matching fee, tax, or refund entry found to explain the gap.`;
      recommendedAction = "Request Finance Review";
      aiReview = confidence < 90;
      break;
    }
    case "DUPLICATE_RECORD":
      confidence = 35;
      rootCause = `This settlement appears to duplicate an existing record (${txn.duplicateOf}). Manual verification is required before any action is taken.`;
      recommendedAction = "Escalate";
      aiReview = true;
      break;
    default:
      confidence = 50;
      rootCause = "Unable to determine a root cause from available data.";
      recommendedAction = "Escalate";
      aiReview = true;
  }

  return {
    exception_type: EXC_TYPES[type],
    root_cause: rootCause,
    confidence,
    severity: record.severity,
    recommended_action: recommendedAction,
    human_review_required: aiReview,
    reason: `Derived from transaction data (variance ${inr(v)}, type ${EXC_TYPES[type]}) using the rule-based deterministic engine.`,
  };
}

/* ---------------------------------------------------------------------- */
/* Safety gate                                                             */
/* ---------------------------------------------------------------------- */

function evaluateSafetyGate(record, ai, settings) {
  const v = Math.abs(record.variance);
  if (record.type === "DUPLICATE_RECORD" || ai.confidence < 50) {
    return {
      status: "BLOCKED",
      reason:
        record.type === "DUPLICATE_RECORD"
          ? "This record is flagged as a possible duplicate settlement. Duplicate records always require manual verification and cannot be auto-resolved or approved through the standard flow."
          : `AI confidence (${ai.confidence}%) is too low to support any automated or approved resolution path.`,
    };
  }
  if (settings.autoResolutionEnabled && ai.confidence >= settings.minConfidence && v <= settings.autoResolutionMax) {
    return {
      status: "PASSED",
      reason: `Confidence ${ai.confidence}% meets the ${settings.minConfidence}% minimum, and the variance of ${inr(v)} is within the ${inr(
        settings.autoResolutionMax
      )} auto-resolution limit.`,
    };
  }
  if (v > settings.highValueThreshold) {
    return {
      status: "BLOCKED",
      reason: `Variance of ${inr(v)} exceeds the ${inr(settings.highValueThreshold)} high-value threshold and cannot be auto-resolved without escalation.`,
    };
  }
  return {
    status: "REVIEW",
    reason: `Confidence ${ai.confidence}% or variance ${inr(v)} falls outside the configured auto-resolution limits (min confidence ${
      settings.minConfidence
    }%, max ${inr(settings.autoResolutionMax)}). Human approval is required before this can proceed.`,
  };
}

const DEFAULT_SETTINGS = { minConfidence: 90, autoResolutionMax: 5000, highValueThreshold: 10000, autoResolutionEnabled: true };

const RESOLUTION_ACTIONS = [
  { key: "mark_expected", label: "Mark as Expected Adjustment", terminal: true },
  { key: "request_settlement_review", label: "Request Settlement Review", terminal: false },
  { key: "request_finance_review", label: "Request Finance Review", terminal: false },
  { key: "mark_resolved", label: "Mark as Resolved", terminal: true },
  { key: "escalate", label: "Escalate", terminal: false },
  { key: "reject", label: "Reject Recommendation", terminal: false },
];

const STATUS_META = {
  OPEN: { label: "Open", cls: "bg-slate-100 text-slate-700" },
  INVESTIGATING: { label: "Investigating", cls: "bg-blue-50 text-blue-700" },
  REVIEW_REQUIRED: { label: "Review Required", cls: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-indigo-50 text-indigo-700" },
  RESOLVED: { label: "Resolved", cls: "bg-emerald-50 text-emerald-700" },
  BLOCKED: { label: "Blocked", cls: "bg-red-50 text-red-700" },
  ESCALATED: { label: "Escalated", cls: "bg-purple-50 text-purple-700" },
  REJECTED: { label: "Rejected", cls: "bg-slate-100 text-slate-500" },
};

const SEVERITY_META = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

/* ---------------------------------------------------------------------- */
/* Small shared UI primitives                                              */
/* ---------------------------------------------------------------------- */

function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${className}`}>{children}</span>;
}

function Button({ children, onClick, variant = "primary", disabled, className = "", icon: Icon, type = "button" }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium px-3.5 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function EmptyState({ title, body }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <CheckCircle2 size={20} className="text-slate-400" />
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">{body}</p>
    </div>
  );
}

function SafetyGateCard({ gate }) {
  if (!gate) return null;
  const map = {
    PASSED: { icon: ShieldCheck, cls: "border-emerald-200 bg-emerald-50", iconCls: "text-emerald-600", label: "Passed" },
    REVIEW: { icon: ShieldQuestion, cls: "border-amber-200 bg-amber-50", iconCls: "text-amber-600", label: "Human Review Required" },
    BLOCKED: { icon: ShieldAlert, cls: "border-red-200 bg-red-50", iconCls: "text-red-600", label: "Blocked" },
  };
  const m = map[gate.status];
  const Icon = m.icon;
  return (
    <div className={`rounded-xl border p-4 ${m.cls}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={18} className={m.iconCls} />
        <span className="font-semibold text-slate-900 text-sm">Safety Gate — {m.label}</span>
      </div>
      <p className="text-sm text-slate-700">{gate.reason}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Toasts                                                                   */
/* ---------------------------------------------------------------------- */

function ToastStack({ toasts, dismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[92vw]">
      {toasts.map((t) => {
        const style =
          t.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : t.type === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-red-200 bg-red-50 text-red-800";
        const ToastIcon = t.type === "success" ? CheckCircle2 : t.type === "warning" ? AlertTriangle : XCircle;
        const iconCls = t.type === "success" ? "text-emerald-600" : t.type === "warning" ? "text-amber-600" : "text-red-600";
        return (
          <div key={t.id} role="status" className={`rounded-lg border shadow-md px-3.5 py-2.5 text-sm flex items-start gap-2 ${style}`}>
            <ToastIcon size={16} className={`mt-0.5 shrink-0 ${iconCls}`} />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Sidebar                                                                  */
/* ---------------------------------------------------------------------- */

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "exceptions", label: "Exceptions", icon: ListChecks },
  { key: "reconciliation", label: "Reconciliation", icon: RefreshCw },
  { key: "investigator", label: "AI Investigator", icon: BrainCircuit },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar({ page, setPage, mobileOpen, setMobileOpen }) {
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={`fixed lg:static z-40 top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">St</div>
          <span className="font-semibold text-slate-900 tracking-tight">SettleTrace</span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setPage(item.key);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>AI Engine</span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <Circle size={7} className="fill-emerald-500 text-emerald-500" /> Online
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Environment</span>
            <span className="flex items-center gap-1 text-slate-500 font-medium">
              <Circle size={7} className="fill-slate-400 text-slate-400" /> Demo Mode
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Login page                                                              */
/* ---------------------------------------------------------------------- */

function LoginPage({ onEnter, loading }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-6">
          St
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight leading-snug">
          Turn reconciliation exceptions into clear decisions.
        </h1>
        <p className="text-slate-500 mt-3 text-sm leading-relaxed">
          AI-powered investigation for payment settlement mismatches.
        </p>
        <Button onClick={onEnter} disabled={loading} className="mt-8 w-full py-2.5" icon={loading ? Loader2 : LogIn}>
          {loading ? "Loading demo data…" : "Enter Demo"}
        </Button>
        <p className="text-xs text-slate-400 mt-4">No account needed — this loads a self-contained demo dataset.</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Top bar (mobile menu trigger + page title)                              */
/* ---------------------------------------------------------------------- */

function TopBar({ title, onMenu }) {
  return (
    <div className="h-16 border-b border-slate-200 bg-white flex items-center px-4 lg:px-8 gap-3 sticky top-0 z-20">
      <button className="lg:hidden p-1.5 -ml-1 text-slate-500" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <h1 className="font-semibold text-slate-900 text-base">{title}</h1>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Metric tile                                                             */
/* ---------------------------------------------------------------------- */

function Metric({ label, value, sub, accent }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1.5 ${accent || "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </Card>
  );
}

/* ---------------------------------------------------------------------- */
/* Dashboard                                                                */
/* ---------------------------------------------------------------------- */

const PIE_COLORS = ["#4f46e5", "#0ea5e9", "#f59e0b", "#ef4444", "#10b981", "#a855f7"];

function Dashboard({ records, exceptions, goto, onInvestigate, onRunRecon, reconciling, auditCount }) {
  const total = records.length;
  const matched = records.filter((r) => r.matched).length;
  const excCount = exceptions.length;
  const excValue = exceptions.reduce((s, r) => s + Math.abs(r.variance), 0);
  const rate = total ? Math.round((matched / total) * 1000) / 10 : 0;
  const resolved = exceptions.filter((r) => r.status === "RESOLVED").length;

  const typeBreakdown = useMemo(() => {
    const counts = {};
    exceptions.forEach((r) => {
      counts[EXC_TYPES[r.type]] = (counts[EXC_TYPES[r.type]] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [exceptions]);

  const valueByType = useMemo(() => {
    const sums = {};
    exceptions.forEach((r) => {
      const k = EXC_TYPES[r.type];
      sums[k] = (sums[k] || 0) + Math.abs(r.variance);
    });
    return Object.entries(sums).map(([name, value]) => ({ name, value }));
  }, [exceptions]);

  const trend = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
    const base = [92.1, 93.4, 91.8, 94.2, 90.6, 93.0];
    return days.map((d, i) => ({ day: d, rate: i === 6 ? rate : base[i] }));
  }, [rate]);

  const resolutionPerf = useMemo(() => {
    const buckets = { Open: 0, Investigating: 0, "Review Required": 0, Resolved: 0, Blocked: 0 };
    exceptions.forEach((r) => {
      if (r.status === "OPEN") buckets.Open++;
      else if (r.status === "INVESTIGATING") buckets.Investigating++;
      else if (r.status === "REVIEW_REQUIRED") buckets["Review Required"]++;
      else if (r.status === "RESOLVED") buckets.Resolved++;
      else if (r.status === "BLOCKED") buckets.Blocked++;
      else buckets.Open++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [exceptions]);

  const topExceptions = exceptions
    .filter((r) => r.status !== "RESOLVED")
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 5);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Finance Control Center</h2>
          <p className="text-sm text-slate-500 mt-0.5">Live reconciliation health across all settlements.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={ListChecks} onClick={() => goto("exceptions")}>
            View Exceptions
          </Button>
          <Button variant="secondary" icon={ScrollText} onClick={() => goto("audit")}>
            View Audit Logs
          </Button>
          <Button icon={reconciling ? Loader2 : RefreshCw} disabled={reconciling} onClick={onRunRecon}>
            {reconciling ? "Running…" : "Run Reconciliation"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Metric label="Total Payments" value={total} />
        <Metric label="Matched Payments" value={matched} accent="text-emerald-600" />
        <Metric label="Exceptions" value={excCount} accent="text-red-600" />
        <Metric label="Exception Value" value={inr(excValue)} />
        <Metric label="Reconciliation Rate" value={`${rate}%`} accent="text-indigo-600" />
        <Metric label="Resolved Exceptions" value={resolved} sub={`of ${excCount} total`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Reconciliation Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Exception Breakdown</p>
          {typeBreakdown.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {typeBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No exceptions" body="All payment records are currently reconciled." />
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Exception Value by Type</p>
          {valueByType.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={valueByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v) => inr(v)} />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No exceptions" body="All payment records are currently reconciled." />
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Resolution Performance</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={resolutionPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-800">Highest-Impact Open Exceptions</p>
          <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => goto("exceptions")}>
            View all
          </button>
        </div>
        {topExceptions.length === 0 ? (
          <EmptyState title="No exceptions" body="All payment records are currently reconciled." />
        ) : (
          <div className="divide-y divide-slate-100">
            {topExceptions.map((r) => (
              <div key={r.txn.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{r.txn.id}</p>
                  <p className="text-xs text-slate-500">{EXC_TYPES[r.type]} · {r.txn.customer}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-700">{inr(Math.abs(r.variance))}</span>
                  <Badge className={STATUS_META[r.status]?.cls}>{STATUS_META[r.status]?.label}</Badge>
                  <Button variant="secondary" onClick={() => onInvestigate(r.txn.id)}>Investigate</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Reconciliation page                                                     */
/* ---------------------------------------------------------------------- */

function ReconciliationPage({ records, exceptions, onRunRecon, reconciling, lastRun }) {
  const total = records.length;
  const matched = records.filter((r) => r.matched).length;
  const rate = total ? Math.round((matched / total) * 1000) / 10 : 0;
  const totalVariance = exceptions.reduce((s, r) => s + Math.abs(r.variance), 0);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Reconciliation Control Center</h2>
        <p className="text-sm text-slate-500 mt-0.5">Run the deterministic engine to compare payments against settlements.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Metric label="Total Records" value={total} />
        <Metric label="Matched" value={matched} accent="text-emerald-600" />
        <Metric label="Exceptions" value={exceptions.length} accent="text-red-600" />
        <Metric label="Match Rate" value={`${rate}%`} accent="text-indigo-600" />
        <Metric label="Total Variance" value={inr(totalVariance)} />
      </div>

      <Card className="p-6 flex flex-col items-start gap-4">
        <div>
          <p className="font-medium text-slate-800">Run the reconciliation engine</p>
          <p className="text-sm text-slate-500 mt-1 max-w-lg">
            Compares payment amount, fees, taxes, refunds and adjustments against actual settlements for every record, then
            recalculates all exceptions and dashboard metrics.
          </p>
          {lastRun && <p className="text-xs text-slate-400 mt-2">Last run: {fmtDateTime(lastRun)}</p>}
        </div>
        <Button icon={reconciling ? Loader2 : RefreshCw} disabled={reconciling} onClick={onRunRecon}>
          {reconciling ? "Processing…" : "Run Reconciliation"}
        </Button>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-800 mb-3">Exception Types in Current Run</p>
        {exceptions.length === 0 ? (
          <EmptyState title="No exceptions" body="All payment records are currently reconciled." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(
              exceptions.reduce((acc, r) => {
                acc[r.type] = (acc[r.type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => (
              <div key={type} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-slate-700">{EXC_TYPES[type]}</span>
                <Badge className="bg-slate-100 text-slate-700">{count}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Exceptions table page                                                   */
/* ---------------------------------------------------------------------- */

const FILTERS = ["All", "Open", "Investigating", "Review Required", "Approved", "Resolved", "Blocked"];
const PAGE_SIZE = 10;

function ExceptionsPage({ exceptions, openDrawer }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortKey, setSortKey] = useState("variance");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = exceptions;
    if (filter !== "All") {
      const key = filter.toUpperCase().replace(" ", "_");
      rows = rows.filter((r) => r.status === key);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) => r.txn.id.toLowerCase().includes(q) || r.txn.customer.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
      );
    }
    const sorted = [...rows].sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "amount": av = a.txn.amount; bv = b.txn.amount; break;
        case "variance": av = Math.abs(a.variance); bv = Math.abs(b.variance); break;
        case "confidence": av = a.aiResult?.confidence ?? -1; bv = b.aiResult?.confidence ?? -1; break;
        case "severity": {
          const order = { low: 0, medium: 1, high: 2, critical: 3 };
          av = order[a.severity] ?? -1; bv = order[b.severity] ?? -1; break;
        }
        case "date": av = new Date(a.txn.timestamp).getTime(); bv = new Date(b.txn.timestamp).getTime(); break;
        default: av = 0; bv = 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [exceptions, filter, query, sortKey, sortDir]);

  useEffect(() => setPage(1), [filter, query, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortHeader = ({ label, k }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700">
      {label} <ArrowUpDown size={11} className={sortKey === k ? "text-indigo-600" : "text-slate-300"} />
    </button>
  );

  return (
    <div className="p-4 lg:p-8 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Exceptions</h2>
        <p className="text-sm text-slate-500 mt-0.5">{exceptions.length} total · {filtered.length} matching current filters</p>
      </div>

      <Card className="p-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transaction, exception ID or customer…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === f ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f}
            </button>
          ))}
          {(query || filter !== "All") && (
            <button
              onClick={() => { setQuery(""); setFilter("All"); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {pageRows.length === 0 ? (
          <EmptyState title="No matching exceptions" body="Try adjusting your search or filters — or reset them to see everything." />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3"><SortHeader label="Exception" k="date" /></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Transaction</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                    <th className="text-left px-4 py-3"><SortHeader label="Amount" k="amount" /></th>
                    <th className="text-left px-4 py-3"><SortHeader label="Variance" k="variance" /></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3"><SortHeader label="Severity" k="severity" /></th>
                    <th className="text-left px-4 py-3"><SortHeader label="Confidence" k="confidence" /></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recommended</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openDrawer(r.txn.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(r.txn.id); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open exception ${r.id} for transaction ${r.txn.id}`}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    >
                      <td className="px-4 py-3 font-medium text-indigo-700">{r.id}</td>
                      <td className="px-4 py-3 text-slate-700">{r.txn.id}</td>
                      <td className="px-4 py-3 text-slate-600">{r.txn.customer}</td>
                      <td className="px-4 py-3 text-slate-700">{inr(r.txn.amount)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{inr(Math.abs(r.variance))}</td>
                      <td className="px-4 py-3 text-slate-600">{EXC_TYPES[r.type]}</td>
                      <td className="px-4 py-3"><Badge className={SEVERITY_META[r.severity]}>{r.severity}</Badge></td>
                      <td className="px-4 py-3 text-slate-600">{r.aiResult ? `${r.aiResult.confidence}%` : "—"}</td>
                      <td className="px-4 py-3"><Badge className={STATUS_META[r.status]?.cls}>{STATUS_META[r.status]?.label}</Badge></td>
                      <td className="px-4 py-3 text-slate-500">{r.aiResult?.recommended_action || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {pageRows.map((r) => (
                <button key={r.id} onClick={() => openDrawer(r.txn.id)} className="w-full text-left p-4 hover:bg-slate-50">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-indigo-700 text-sm">{r.txn.id}</span>
                    <Badge className={STATUS_META[r.status]?.cls}>{STATUS_META[r.status]?.label}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">{r.txn.customer} · {EXC_TYPES[r.type]}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-slate-800">{inr(Math.abs(r.variance))} variance</span>
                    <Badge className={SEVERITY_META[r.severity]}>{r.severity}</Badge>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500 text-xs">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="secondary" icon={ChevronRight} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* AI Investigator page                                                    */
/* ---------------------------------------------------------------------- */

function InvestigatorPage({ exceptions, openDrawer }) {
  const awaiting = exceptions.filter((r) => !r.aiResult);
  const highConfidence = exceptions.filter((r) => r.aiResult && r.aiResult.confidence >= 90 && r.status !== "RESOLVED");
  const needsReview = exceptions.filter((r) => r.safetyGate?.status === "REVIEW" || r.safetyGate?.status === "BLOCKED");
  const resolved = exceptions.filter((r) => r.status === "RESOLVED").slice(-6).reverse();

  const Section = ({ title, rows, empty, tone }) => (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-800 mb-3">{title} <span className="text-slate-400 font-normal">({rows.length})</span></p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 6).map((r) => (
            <button
              key={r.id}
              onClick={() => openDrawer(r.txn.id)}
              className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{r.txn.id}</p>
                <p className="text-xs text-slate-500">{EXC_TYPES[r.type]} · {inr(Math.abs(r.variance))}</p>
              </div>
              {r.aiResult ? (
                <Badge className={tone}>{r.aiResult.confidence}%</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-600">Pending</Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">AI Investigator</h2>
        <p className="text-sm text-slate-500 mt-0.5">Command center for AI-assisted root-cause analysis across all exceptions.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Exceptions Awaiting Investigation" rows={awaiting} empty="Everything has been investigated." tone="bg-slate-100 text-slate-600" />
        <Section title="High Confidence Findings" rows={highConfidence} empty="No high-confidence findings yet." tone="bg-emerald-50 text-emerald-700" />
        <Section title="Human Review Required" rows={needsReview} empty="Nothing is waiting on a human decision." tone="bg-amber-50 text-amber-700" />
        <Section title="Recently Resolved" rows={resolved} empty="No exceptions resolved yet." tone="bg-indigo-50 text-indigo-700" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Audit logs page                                                         */
/* ---------------------------------------------------------------------- */

function AuditPage({ log }) {
  return (
    <div className="p-4 lg:p-8 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Audit Logs</h2>
        <p className="text-sm text-slate-500 mt-0.5">Full decision trail — every automated and human action is recorded here.</p>
      </div>
      <Card className="overflow-hidden">
        {log.length === 0 ? (
          <EmptyState title="No audit events yet" body="Run a reconciliation or investigate an exception to start building the trail." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Timestamp", "Event", "Transaction", "AI Decision", "Safety Decision", "Merchant Decision", "Result"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...log].reverse().map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDateTime(e.timestamp)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{e.event}</td>
                    <td className="px-4 py-3 text-indigo-700 whitespace-nowrap">{e.transactionId || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs">{e.aiDecision || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{e.safetyDecision || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{e.merchantDecision || "—"}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs">{e.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Settings page                                                           */
/* ---------------------------------------------------------------------- */

function SettingsPage({ settings, onSave, onReset }) {
  const [form, setForm] = useState(settings);
  const [error, setError] = useState("");

  useEffect(() => setForm(settings), [settings]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    if (form.minConfidence < 0 || form.minConfidence > 100) return setError("Minimum AI confidence must be between 0 and 100.");
    if (form.autoResolutionMax < 0) return setError("Auto resolution limit must be a positive amount.");
    if (form.highValueThreshold <= form.autoResolutionMax) return setError("High-value threshold must be greater than the auto-resolution limit.");
    setError("");
    onSave(form);
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">These thresholds control the Safety Gate live across the whole app.</p>
      </div>

      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Auto Resolution Enabled</p>
            <p className="text-xs text-slate-500 mt-0.5">Allow exceptions that pass the Safety Gate to be resolved without manual approval.</p>
          </div>
          <button
            onClick={() => update("autoResolutionEnabled", !form.autoResolutionEnabled)}
            className={`w-11 h-6 rounded-full transition-colors relative ${form.autoResolutionEnabled ? "bg-indigo-600" : "bg-slate-200"}`}
            aria-pressed={form.autoResolutionEnabled}
            aria-label="Toggle auto resolution"
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.autoResolutionEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-800">Minimum AI Confidence (%)</label>
          <input
            type="number"
            value={form.minConfidence}
            onChange={(e) => update("minConfidence", Number(e.target.value))}
            className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-800">Auto Resolution Maximum (₹)</label>
          <input
            type="number"
            value={form.autoResolutionMax}
            onChange={(e) => update("autoResolutionMax", Number(e.target.value))}
            className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-800">High-Value Threshold (₹)</label>
          <input
            type="number"
            value={form.highValueThreshold}
            onChange={(e) => update("highValueThreshold", Number(e.target.value))}
            className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</p>}

        <div className="flex gap-2 pt-1">
          <Button onClick={save}>Save Settings</Button>
          <Button variant="secondary" onClick={() => { onReset(); setError(""); }}>Reset to Defaults</Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Exception detail drawer                                                 */
/* ---------------------------------------------------------------------- */

function ExceptionDrawer({ record, onClose, onInvestigate, investigating, onResolve }) {
  if (!record) return null;
  const { txn, expected, actual, variance, type, severity, aiResult, safetyGate, status } = record;
  const resolved = status === "RESOLVED";

  // Auto-resolving actions ("mark_expected", "mark_resolved") are the only ones the
  // Safety Gate needs to guard — they finalize the exception. Routing actions
  // (request review, escalate, reject) never bypass the gate, so they stay usable
  // even when BLOCKED; that's how a blocked exception still gets to a human.
  const TERMINAL_ACTIONS = ["mark_expected", "mark_resolved"];
  const canAutoAct = (actionKey) => {
    if (resolved) return false;
    if (!safetyGate) return !TERMINAL_ACTIONS.includes(actionKey);
    if (safetyGate.status === "BLOCKED") return !TERMINAL_ACTIONS.includes(actionKey);
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full sm:w-[480px] bg-white h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="font-semibold text-slate-900">{txn.id}</p>
            <Badge className={STATUS_META[status]?.cls}>{STATUS_META[status]?.label}</Badge>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Transaction Information</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between"><dt className="text-slate-500">Transaction ID</dt><dd className="text-slate-800 font-medium">{txn.id}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Customer</dt><dd className="text-slate-800">{txn.customer}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="text-slate-800">{inr(txn.amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Payment Method</dt><dd className="text-slate-800">{txn.method}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Timestamp</dt><dd className="text-slate-800">{fmtDateTime(txn.timestamp)}</dd></div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Settlement Information</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between"><dt className="text-slate-500">Settlement ID</dt><dd className="text-slate-800">{txn.settlementId || "Not yet settled"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Expected Amount</dt><dd className="text-slate-800">{inr(expected)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Actual Amount</dt><dd className="text-slate-800">{actual === null ? "—" : inr(actual)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Variance</dt><dd className="font-medium text-slate-900">{inr(Math.abs(variance))}</dd></div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Exception Information</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between"><dt className="text-slate-500">Type</dt><dd className="text-slate-800">{EXC_TYPES[type]}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Severity</dt><dd><Badge className={SEVERITY_META[severity]}>{severity}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd><Badge className={STATUS_META[status]?.cls}>{STATUS_META[status]?.label}</Badge></dd></div>
            </dl>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">AI Investigation</h3>
            </div>
            {!aiResult ? (
              <Button icon={investigating ? Loader2 : BrainCircuit} disabled={investigating} onClick={() => onInvestigate(txn.id)} className="w-full justify-center">
                {investigating ? "Investigating…" : "Investigate with AI"}
              </Button>
            ) : (
              <div className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50">
                <p className="text-[11px] text-slate-400">AI Investigation Engine · Status: Demo / rule-based fallback</p>
                <div>
                  <p className="text-xs font-medium text-slate-500">Root Cause</p>
                  <p className="text-sm text-slate-800 mt-0.5">{aiResult.root_cause}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Confidence</p>
                    <p className="text-sm font-semibold text-slate-900">{aiResult.confidence}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Severity</p>
                    <p className="text-sm font-semibold text-slate-900 capitalize">{aiResult.severity}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Recommended Action</p>
                  <p className="text-sm text-slate-800">{aiResult.recommended_action}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Human Review Required</p>
                  <p className="text-sm text-slate-800">{aiResult.human_review_required ? "Yes" : "Not Required"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Reasoning</p>
                  <p className="text-xs text-slate-500 mt-0.5">{aiResult.reason}</p>
                </div>
              </div>
            )}
          </section>

          {safetyGate && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Safety Gate</h3>
              <SafetyGateCard gate={safetyGate} />
            </section>
          )}

          {aiResult && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Resolution</h3>
              {resolved ? (
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">Already resolved.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {RESOLUTION_ACTIONS.map((a) => (
                    <Button
                      key={a.key}
                      variant={a.key === "reject" ? "danger" : a.terminal ? "success" : "secondary"}
                      disabled={!canAutoAct(a.key)}
                      onClick={() => onResolve(txn.id, a.key)}
                      className="w-full justify-center"
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Approval modal                                                          */
/* ---------------------------------------------------------------------- */

function ApprovalModal({ pending, onApprove, onReject, onRequestReview, onClose }) {
  if (!pending) return null;
  const { record, action } = pending;
  const actionLabel = RESOLUTION_ACTIONS.find((a) => a.key === action)?.label;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldQuestion size={19} className="text-amber-600" />
          <h3 className="font-semibold text-slate-900">Human Approval Required</h3>
        </div>
        <dl className="text-sm space-y-1.5 mb-4">
          <div className="flex justify-between"><dt className="text-slate-500">Transaction</dt><dd className="font-medium text-slate-800">{record.txn.id}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="text-slate-800">{inr(record.txn.amount)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Variance</dt><dd className="text-slate-800">{inr(Math.abs(record.variance))}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">AI Confidence</dt><dd className="text-slate-800">{record.aiResult.confidence}%</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Requested Action</dt><dd className="text-slate-800">{actionLabel}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Safety Decision</dt><dd className="text-amber-700 font-medium">{record.safetyGate.status}</dd></div>
        </dl>
        <p className="text-xs text-slate-500 mb-4">{record.safetyGate.reason}</p>
        <div className="flex flex-col gap-2">
          <Button variant="success" onClick={onApprove} className="w-full justify-center">Approve Resolution</Button>
          <Button variant="secondary" onClick={onRequestReview} className="w-full justify-center">Request Review</Button>
          <Button variant="danger" onClick={onReject} className="w-full justify-center">Reject</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Root application                                                        */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [entered, setEntered] = useState(false);
  const [entering, setEntering] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [transactions] = useState(() => generateTransactions());
  const [records, setRecords] = useState([]); // workflow-augmented records (one per transaction)
  const [reconciling, setReconciling] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [auditLog, setAuditLog] = useState([]);
  const [toasts, setToasts] = useState([]);

  const [drawerTxnId, setDrawerTxnId] = useState(null);
  const [investigatingId, setInvestigatingId] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);

  const auditIdRef = useRef(1);
  const toastIdRef = useRef(1);

  const pushToast = useCallback((type, message) => {
    const id = toastIdRef.current++;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const pushAudit = useCallback((entry) => {
    setAuditLog((log) => [
      ...log,
      { id: auditIdRef.current++, timestamp: new Date().toISOString(), ...entry },
    ]);
  }, []);

  const runReconciliation = useCallback(() => {
    if (reconciling) return;
    setReconciling(true);
    pushAudit({ event: "Reconciliation started", result: `Processing ${transactions.length} records.` });
    setTimeout(() => {
      const { records: fresh } = reconcile(transactions);
      setRecords((prev) => {
        const byId = new Map(prev.map((r) => [r.txn.id, r]));
        return fresh.map((r) => {
          const existing = byId.get(r.txn.id);
          const id = `EXC_${r.txn.id.split("_")[1]}`;
          if (existing) return { ...r, id, status: existing.status, aiResult: existing.aiResult, safetyGate: existing.safetyGate };
          return { ...r, id, status: r.matched ? "MATCHED" : "OPEN", aiResult: null, safetyGate: null };
        });
      });
      const matchedCount = fresh.filter((r) => r.matched).length;
      const excCount = fresh.length - matchedCount;
      setLastRun(new Date().toISOString());
      pushAudit({
        event: "Reconciliation completed",
        result: `${fresh.length} records processed, ${matchedCount} matched, ${excCount} exceptions found.`,
      });
      pushToast("success", `Reconciliation completed — ${fresh.length} records processed, ${matchedCount} matched, ${excCount} exceptions found.`);
      setReconciling(false);
    }, 700);
  }, [reconciling, transactions, pushAudit, pushToast]);

  const enterDemo = () => {
    setEntering(true);
    setTimeout(() => {
      const { records: fresh } = reconcile(transactions);
      setRecords(
        fresh.map((r) => ({
          ...r,
          id: `EXC_${r.txn.id.split("_")[1]}`,
          status: r.matched ? "MATCHED" : "OPEN",
          aiResult: null,
          safetyGate: null,
        }))
      );
      setLastRun(new Date().toISOString());
      const matchedCount = fresh.filter((r) => r.matched).length;
      pushAudit({ event: "Demo data initialized", result: `${fresh.length} transactions loaded, initial reconciliation run (${matchedCount} matched).` });
      setEntering(false);
      setEntered(true);
    }, 650);
  };

  const exceptions = useMemo(() => records.filter((r) => !r.matched), [records]);

  const updateRecord = (txnId, patch) => {
    setRecords((prev) => prev.map((r) => (r.txn.id === txnId ? { ...r, ...patch } : r)));
  };

  const investigate_ = (txnId) => {
    const record = records.find((r) => r.txn.id === txnId);
    if (!record || record.aiResult) return;
    setInvestigatingId(txnId);
    updateRecord(txnId, { status: "INVESTIGATING" });
    setTimeout(() => {
      const ai = investigate(record);
      const gate = evaluateSafetyGate(record, ai, settings);
      const nextStatus = gate.status === "BLOCKED" ? "BLOCKED" : gate.status === "REVIEW" ? "REVIEW_REQUIRED" : "APPROVED";
      updateRecord(txnId, { aiResult: ai, safetyGate: gate, status: nextStatus });
      pushAudit({
        event: "AI investigation completed",
        transactionId: txnId,
        aiDecision: `${ai.recommended_action} (${ai.confidence}% confidence)`,
        safetyDecision: gate.status,
        result: ai.root_cause,
      });
      pushToast("success", `AI investigation completed for ${txnId}.`);
      if (gate.status === "REVIEW") pushToast("warning", `${txnId}: human review required before this can be resolved.`);
      setInvestigatingId(null);
    }, 800);
  };

  const applyResolution = (txnId, action, merchantDecision) => {
    const record = records.find((r) => r.txn.id === txnId);
    if (!record) return;
    const map = {
      mark_expected: "RESOLVED",
      mark_resolved: "RESOLVED",
      request_settlement_review: "REVIEW_REQUIRED",
      request_finance_review: "REVIEW_REQUIRED",
      escalate: "ESCALATED",
      reject: "REJECTED",
    };
    const newStatus = map[action] || record.status;
    updateRecord(txnId, { status: newStatus });
    const label = RESOLUTION_ACTIONS.find((a) => a.key === action)?.label;
    pushAudit({
      event: newStatus === "RESOLVED" ? "Exception resolved" : label,
      transactionId: txnId,
      aiDecision: record.aiResult ? `${record.aiResult.recommended_action} (${record.aiResult.confidence}%)` : "—",
      safetyDecision: record.safetyGate?.status || "—",
      merchantDecision,
      result: newStatus === "RESOLVED" ? `${txnId} marked as resolved.` : `${txnId} status set to ${STATUS_META[newStatus]?.label}.`,
    });
    if (newStatus === "RESOLVED") pushToast("success", `Exception resolved for ${txnId}.`);
    else if (newStatus === "REJECTED") pushToast("error", `Recommendation rejected for ${txnId}.`);
    else pushToast("success", `${txnId} updated to ${STATUS_META[newStatus]?.label}.`);
  };

  const handleResolve = (txnId, action) => {
    const record = records.find((r) => r.txn.id === txnId);
    if (!record) return;
    if (record.status === "RESOLVED") {
      pushToast("error", "Already resolved.");
      return;
    }
    const gate = record.safetyGate;
    const terminalActions = ["mark_expected", "mark_resolved"];
    if (gate?.status === "BLOCKED" && terminalActions.includes(action)) {
      pushToast("error", "Resolution blocked — see Safety Gate reason.");
      pushAudit({
        event: "Resolution blocked",
        transactionId: txnId,
        safetyDecision: "BLOCKED",
        result: gate.reason,
      });
      return;
    }
    if (gate?.status === "REVIEW" && ["mark_expected", "mark_resolved"].includes(action)) {
      setPendingApproval({ record, action });
      return;
    }
    applyResolution(txnId, action, "Approved (auto — safety gate passed)");
  };

  // Re-evaluate the Safety Gate for every already-investigated, not-yet-final
  // exception whenever thresholds change, so the new settings take effect
  // immediately (spec 28) without silently rewriting resolved/rejected/escalated history.
  const TERMINAL_STATUSES = ["RESOLVED", "REJECTED", "ESCALATED"];
  const applySettingsToGates = (newSettings) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (!r.aiResult || TERMINAL_STATUSES.includes(r.status)) return r;
        const gate = evaluateSafetyGate(r, r.aiResult, newSettings);
        const nextStatus = gate.status === "BLOCKED" ? "BLOCKED" : gate.status === "REVIEW" ? "REVIEW_REQUIRED" : "APPROVED";
        return { ...r, safetyGate: gate, status: nextStatus };
      })
    );
  };

  const handleSaveSettings = (s) => {
    setSettings(s);
    applySettingsToGates(s);
    pushToast("success", "Settings saved.");
    pushAudit({
      event: "Settings updated",
      result: `Min confidence ${s.minConfidence}%, auto max ${inr(s.autoResolutionMax)}, high-value ${inr(s.highValueThreshold)}. Applied live to all open investigations.`,
    });
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    applySettingsToGates(DEFAULT_SETTINGS);
    pushToast("success", "Settings reset to defaults.");
    pushAudit({ event: "Settings reset", result: "Restored default thresholds (90% / ₹5,000 / ₹10,000) and re-applied them to all open investigations." });
  };

  const drawerRecord = records.find((r) => r.txn.id === drawerTxnId) || null;

  const goto = (p) => { setPage(p); setDrawerTxnId(null); };
  const openDrawer = (txnId) => setDrawerTxnId(txnId);

  const pageTitles = {
    dashboard: "Dashboard",
    exceptions: "Exceptions",
    reconciliation: "Reconciliation",
    investigator: "AI Investigator",
    audit: "Audit Logs",
    settings: "Settings",
  };

  if (!entered) return <LoginPage onEnter={enterDemo} loading={entering} />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar page={page} setPage={goto} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar title={pageTitles[page]} onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 min-w-0">
          {page === "dashboard" && (
            <Dashboard
              records={records}
              exceptions={exceptions}
              goto={goto}
              onInvestigate={openDrawer}
              onRunRecon={runReconciliation}
              reconciling={reconciling}
            />
          )}
          {page === "exceptions" && <ExceptionsPage exceptions={exceptions} openDrawer={openDrawer} />}
          {page === "reconciliation" && (
            <ReconciliationPage records={records} exceptions={exceptions} onRunRecon={runReconciliation} reconciling={reconciling} lastRun={lastRun} />
          )}
          {page === "investigator" && <InvestigatorPage exceptions={exceptions} openDrawer={openDrawer} />}
          {page === "audit" && <AuditPage log={auditLog} />}
          {page === "settings" && (
            <SettingsPage settings={settings} onSave={handleSaveSettings} onReset={handleResetSettings} />
          )}
        </main>
      </div>

      {drawerRecord && (
        <ExceptionDrawer
          record={drawerRecord}
          onClose={() => setDrawerTxnId(null)}
          onInvestigate={investigate_}
          investigating={investigatingId === drawerRecord.txn.id}
          onResolve={handleResolve}
        />
      )}

      <ApprovalModal
        pending={pendingApproval}
        onClose={() => setPendingApproval(null)}
        onApprove={() => { applyResolution(pendingApproval.record.txn.id, pendingApproval.action, "Approved (human review)"); setPendingApproval(null); }}
        onReject={() => { applyResolution(pendingApproval.record.txn.id, "reject", "Rejected (human review)"); setPendingApproval(null); }}
        onRequestReview={() => { applyResolution(pendingApproval.record.txn.id, "request_finance_review", "Sent for finance review"); setPendingApproval(null); }}
      />

      <ToastStack toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}
