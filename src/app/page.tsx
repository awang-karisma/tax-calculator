"use client";

import { useMemo, useState } from "react";
import { useTheme } from "./theme-provider";

const TAX_BRACKETS = [
  { limit: 60_000_000, rate: 0.05 },
  { limit: 250_000_000, rate: 0.15 },
  { limit: 500_000_000, rate: 0.25 },
  { limit: 5_000_000_000, rate: 0.3 },
  { limit: Infinity, rate: 0.35 },
] as const;

const JOB_EXPENSE_RATE = 0.05;
const JOB_EXPENSE_MAX = 6_000_000;
const PTKP_BASE = 54_000_000;
const PTKP_MARRIED = 4_500_000;
const PTKP_DEPENDENT = 4_500_000;
const PTKP_NON_WORKING_SPOUSE = 54_000_000;

type MaritalStatus = "single" | "married";
type IncomePeriod = "yearly" | "monthly";
type TaxInput = {
  grossIncome: number;
  maritalStatus: MaritalStatus;
  dependents: number;
  spouseHasIncome: boolean;
  pensionContribution: number;
  otherDeductions: number;
  hasNpwp: boolean;
};

type TaxBreakdown = {
  grossIncome: number;
  jobExpenseDeduction: number;
  pensionContribution: number;
  otherDeductions: number;
  netIncome: number;
  ptkp: number;
  taxableIncomeRaw: number;
  taxableIncomeRounded: number;
  bracketDetails: {
    rate: number;
    taxableAmount: number;
    tax: number;
  }[];
  taxBeforeNpwp: number;
  npwpMultiplier: number;
  finalTax: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const sanitizeNumber = (value: string) => {
  const numeric = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculatePtkp = (
  status: MaritalStatus,
  dependents: number,
  spouseHasIncome: boolean,
) => {
  const clampedDependents = Math.min(Math.max(dependents, 0), 3);
  let ptkp = PTKP_BASE;

  if (status === "married") {
    ptkp += PTKP_MARRIED;

    if (!spouseHasIncome) {
      ptkp += PTKP_NON_WORKING_SPOUSE;
    }
  }

  ptkp += clampedDependents * PTKP_DEPENDENT;

  return ptkp;
};

const calculateTax = ({
  grossIncome,
  maritalStatus,
  dependents,
  spouseHasIncome,
  pensionContribution,
  otherDeductions,
  hasNpwp,
}: TaxInput): TaxBreakdown => {
  const jobExpenseDeduction = Math.min(
    grossIncome * JOB_EXPENSE_RATE,
    JOB_EXPENSE_MAX,
  );
  const totalDeductions =
    jobExpenseDeduction + pensionContribution + otherDeductions;
  const netIncome = Math.max(grossIncome - totalDeductions, 0);
  const ptkp = calculatePtkp(maritalStatus, dependents, spouseHasIncome);
  const taxableIncomeRaw = Math.max(netIncome - ptkp, 0);
  const taxableIncomeRounded = Math.floor(taxableIncomeRaw / 1_000) * 1_000;

  let remaining = taxableIncomeRounded;
  let previousLimit = 0;
  const bracketDetails: TaxBreakdown["bracketDetails"] = [];

  for (const bracket of TAX_BRACKETS) {
    if (remaining <= 0) {
      break;
    }

    const cap =
      Number.isFinite(bracket.limit) && bracket.limit !== Infinity
        ? bracket.limit
        : taxableIncomeRounded;
    const taxableBand = Math.max(Math.min(cap - previousLimit, remaining), 0);

    if (taxableBand > 0) {
      const tax = taxableBand * bracket.rate;
      bracketDetails.push({
        rate: bracket.rate,
        taxableAmount: taxableBand,
        tax,
      });

      remaining -= taxableBand;
    }

    previousLimit =
      Number.isFinite(bracket.limit) && bracket.limit !== Infinity
        ? bracket.limit
        : previousLimit;
  }

  const taxBeforeNpwp = bracketDetails.reduce((sum, band) => sum + band.tax, 0);
  const npwpMultiplier = hasNpwp ? 1 : 1.2;
  const finalTax = taxBeforeNpwp * npwpMultiplier;

  return {
    grossIncome,
    jobExpenseDeduction,
    pensionContribution,
    otherDeductions,
    netIncome,
    ptkp,
    taxableIncomeRaw,
    taxableIncomeRounded,
    bracketDetails,
    taxBeforeNpwp,
    npwpMultiplier,
    finalTax,
  };
};

const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="bg-[var(--surface)] border-4 border-[var(--border)] shadow-[6px_6px_0_var(--shadow)] px-6 py-8 space-y-6">
    <header className="flex items-center justify-between gap-4 border-b-2 border-[var(--border)] pb-3 uppercase tracking-wider text-sm font-semibold">
      <span>{title}</span>
    </header>
    {children}
  </section>
);

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [grossIncomeInput, setGrossIncomeInput] = useState("180000000");
  const [incomePeriod, setIncomePeriod] = useState<IncomePeriod>("yearly");
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus>("single");
  const [dependents, setDependents] = useState(0);
  const [spouseHasIncome, setSpouseHasIncome] = useState(true);
  const [pensionContributionInput, setPensionContributionInput] =
    useState("3600000");
  const [otherDeductionsInput, setOtherDeductionsInput] = useState("0");
  const [hasNpwp, setHasNpwp] = useState(true);

  const grossIncomeValue = useMemo(
    () => Math.max(0, sanitizeNumber(grossIncomeInput)),
    [grossIncomeInput],
  );

  const grossIncomeAnnual = useMemo(
    () =>
      incomePeriod === "monthly" ? grossIncomeValue * 12 : grossIncomeValue,
    [grossIncomeValue, incomePeriod],
  );

  const pensionContribution = useMemo(
    () => Math.max(0, sanitizeNumber(pensionContributionInput)),
    [pensionContributionInput],
  );
  const otherDeductions = useMemo(
    () => Math.max(0, sanitizeNumber(otherDeductionsInput)),
    [otherDeductionsInput],
  );

  const taxBreakdown = useMemo(() => {
    if (grossIncomeAnnual <= 0) {
      return null;
    }

    return calculateTax({
      grossIncome: grossIncomeAnnual,
      maritalStatus,
      dependents,
      spouseHasIncome,
      pensionContribution,
      otherDeductions,
      hasNpwp,
    });
  }, [
    grossIncomeAnnual,
    maritalStatus,
    dependents,
    spouseHasIncome,
    pensionContribution,
    otherDeductions,
    hasNpwp,
  ]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:px-10">
        <header className="flex flex-col gap-6 border-4 border-[var(--border)] bg-[var(--surface)] p-6 shadow-[6px_6px_0_var(--shadow)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">
              Indonesian Income Tax (PPh 21)
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl">
              Tax Calculator
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--accent-text)]">
              Plug in your income and household details to estimate annual tax
              obligations. Calculations follow the latest progressive rates and
              standard deductions applied in Indonesia.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="button-standard h-14 px-6"
          >
            {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
          </button>
        </header>

        <SectionCard title="Tax profile">
          <div className="grid gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold uppercase">
              Gross income (IDR)
              <div className="input-group">
                <input
                  type="text"
                  inputMode="decimal"
                  value={grossIncomeInput}
                  onChange={(event) => setGrossIncomeInput(event.target.value)}
                  className="input-group__field"
                  placeholder={
                    incomePeriod === "monthly"
                      ? "e.g. 15.000.000"
                      : "e.g. 180.000.000"
                  }
                />
                <select
                  value={incomePeriod}
                  onChange={(event) =>
                    setIncomePeriod(event.target.value as IncomePeriod)
                  }
                  className="input-group__select"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <span className="text-xs font-medium normal-case text-[var(--accent-text)]">
                Pick the income period from the dropdown; we annualize amounts
                automatically.
              </span>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold uppercase">
              Family members supported (max 3)
              <input
                type="number"
                min={0}
                max={3}
                value={dependents}
                onChange={(event) =>
                  setDependents(
                    Math.min(
                      3,
                      Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    ),
                  )
                }
                className="input-standard"
              />
              <span className="text-xs font-medium normal-case text-[var(--accent-text)]">
                Count qualifying dependents you financially support and claim as
                part of PTKP (maximum three).
              </span>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold uppercase">
              Marital status
              <select
                value={maritalStatus}
                onChange={(event) =>
                  setMaritalStatus(event.target.value as MaritalStatus)
                }
                className="select-standard"
              >
                <option value="single">Single</option>
                <option value="married">Married</option>
              </select>
              <span className="text-xs font-medium normal-case text-[var(--accent-text)]">
                Determines the PTKP allowance applied; choose Married if you
                file with a spouse.
              </span>
            </label>

            {maritalStatus === "married" && (
              <label className="flex flex-col gap-2 text-sm font-semibold uppercase">
                Spouse has taxable income
                <div className="flex gap-3 text-xs font-medium">
                  <button
                    type="button"
                    aria-pressed={spouseHasIncome}
                    onClick={() => setSpouseHasIncome(true)}
                    className="button-standard h-14 flex-1 px-4"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    aria-pressed={!spouseHasIncome}
                    onClick={() => setSpouseHasIncome(false)}
                    className="button-standard h-14 flex-1 px-4"
                  >
                    No
                  </button>
                </div>
                <span className="text-xs font-medium normal-case text-[var(--accent-text)]">
                  If your spouse has taxable income, include their amount in the
                  Gross Income field above.
                </span>
              </label>
            )}

            <label className="flex flex-col gap-2 text-sm font-semibold uppercase">
              Yearly pension contributions (BPJS/THT)
              <input
                type="text"
                inputMode="decimal"
                value={pensionContributionInput}
                onChange={(event) =>
                  setPensionContributionInput(event.target.value)
                }
                className="input-standard"
                placeholder="0"
              />
              <span className="text-xs font-medium normal-case text-[var(--accent-text)]">
                Provide the total pension contributions deducted within the year
                that qualify for PPh 21 relief.
              </span>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold uppercase">
              Other deductible expenses
              <input
                type="text"
                inputMode="decimal"
                value={otherDeductionsInput}
                onChange={(event) =>
                  setOtherDeductionsInput(event.target.value)
                }
                className="input-standard"
                placeholder="0"
              />
              <span className="text-xs font-medium normal-case text-[var(--accent-text)]">
                Include other allowable deductions (e.g. charitable donations)
                that reduce taxable income.
              </span>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold uppercase">
              Registered with NPWP
              <div className="flex gap-3 text-xs font-medium">
                <button
                  type="button"
                  aria-pressed={hasNpwp}
                  onClick={() => setHasNpwp(true)}
                  className="button-standard h-14 flex-1 px-4"
                >
                  Yes
                </button>
                <button
                  type="button"
                  aria-pressed={!hasNpwp}
                  onClick={() => setHasNpwp(false)}
                  className="button-standard h-14 flex-1 px-4"
                >
                  No
                </button>
              </div>
              <span className="text-xs font-medium normal-case text-[var(--accent-text)]">
                Select Yes if you have an active NPWP to avoid the 20% non-NPWP
                surcharge.
              </span>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Summary & breakdown">
          {!taxBreakdown ? (
            <p className="text-sm uppercase tracking-widest text-[var(--muted)]">
              Enter your details to view the full calculation.
            </p>
          ) : (
            <div className="space-y-8 text-sm uppercase">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col border-4 border-[var(--border)] bg-[var(--background)] p-4 shadow-[4px_4px_0_var(--shadow)]">
                  <span className="text-xs text-[var(--muted)]">
                    Estimated annual tax
                  </span>
                  <strong className="mt-2 text-2xl font-black">
                    {formatCurrency(taxBreakdown.finalTax)}
                  </strong>
                  <span className="mt-3 text-xs text-[var(--accent-text)] normal-case">
                    {incomePeriod === "monthly"
                      ? `Based on monthly income of ${formatCurrency(grossIncomeValue)} (annualized to ${formatCurrency(taxBreakdown.grossIncome)}).`
                      : `Based on annual income of ${formatCurrency(taxBreakdown.grossIncome)}.`}
                  </span>
                  {taxBreakdown.npwpMultiplier > 1 && (
                    <span className="mt-3 text-xs text-[var(--accent-text)] normal-case">
                      Includes 20% surcharge for taxpayers without NPWP.
                    </span>
                  )}
                </div>
                <div className="flex flex-col border-4 border-[var(--border)] bg-[var(--background)] p-4 shadow-[4px_4px_0_var(--shadow)]">
                  <span className="text-xs text-[var(--muted)]">
                    Taxable income (rounded down)
                  </span>
                  <strong className="mt-2 text-2xl font-black">
                    {formatCurrency(taxBreakdown.taxableIncomeRounded)}
                  </strong>
                  <span className="mt-3 text-xs text-[var(--accent-text)]">
                    Rounded down to the nearest Rp1.000 as per PPh 21 rules.
                  </span>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="border-4 border-[var(--border)] bg-[var(--background)] p-5 shadow-[4px_4px_0_var(--shadow)]">
                  <h2 className="text-base font-black">
                    Step-by-step deductions
                  </h2>
                  <ul className="mt-3 space-y-2 text-xs">
                    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-[var(--border)] pb-1">
                      <span className="flex-1 min-w-0 break-words">
                        Gross income (annualized)
                      </span>
                      <span className="text-right">
                        {formatCurrency(taxBreakdown.grossIncome)}
                      </span>
                    </li>
                    {incomePeriod === "monthly" && (
                      <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-[var(--border)] pb-1">
                        <span className="flex-1 min-w-0 break-words">
                          Monthly income provided
                        </span>
                        <span className="text-right">
                          {formatCurrency(grossIncomeValue)}
                        </span>
                      </li>
                    )}
                    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-[var(--border)] pb-1">
                      <span className="flex-1 min-w-0 break-words">
                        Job expense deduction (5% capped at Rp6.000.000)
                      </span>
                      <span className="text-right">
                        {formatCurrency(taxBreakdown.jobExpenseDeduction)}
                      </span>
                    </li>
                    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-[var(--border)] pb-1">
                      <span className="flex-1 min-w-0 break-words">
                        Pension contributions
                      </span>
                      <span className="text-right">
                        {formatCurrency(taxBreakdown.pensionContribution)}
                      </span>
                    </li>
                    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-[var(--border)] pb-1">
                      <span className="flex-1 min-w-0 break-words">
                        Other deductions
                      </span>
                      <span className="text-right">
                        {formatCurrency(taxBreakdown.otherDeductions)}
                      </span>
                    </li>
                    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-[var(--border)] pb-1">
                      <span className="flex-1 min-w-0 break-words">
                        Net income
                      </span>
                      <span className="text-right">
                        {formatCurrency(taxBreakdown.netIncome)}
                      </span>
                    </li>
                    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-[var(--border)] pb-1">
                      <span className="flex-1 min-w-0 break-words">
                        PTKP allowance
                      </span>
                      <span className="text-right">
                        {formatCurrency(taxBreakdown.ptkp)}
                      </span>
                    </li>
                    <li className="flex flex-wrap items-start justify-between gap-2">
                      <span className="flex-1 min-w-0 break-words">
                        Taxable income (before rounding)
                      </span>
                      <span className="text-right">
                        {formatCurrency(taxBreakdown.taxableIncomeRaw)}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="border-4 border-[var(--border)] bg-[var(--background)] p-5 shadow-[4px_4px_0_var(--shadow)]">
                  <h2 className="text-base font-black">
                    Progressive tax bands
                  </h2>
                  <div className="mt-3 grid gap-2">
                    {taxBreakdown.bracketDetails.length === 0 ? (
                      <p className="text-xs text-[var(--muted)]">
                        Your taxable income is zero; no tax is due.
                      </p>
                    ) : (
                      taxBreakdown.bracketDetails.map((band) => (
                        <div
                          key={`${band.rate}-${band.taxableAmount}`}
                          className="grid grid-cols-1 gap-1 border border-dashed border-[var(--border)] bg-[var(--surface)] p-3 text-xs sm:grid-cols-3"
                        >
                          <span>Rate: {(band.rate * 100).toFixed(0)}%</span>
                          <span>
                            Taxed amount: {formatCurrency(band.taxableAmount)}
                          </span>
                          <span>Tax: {formatCurrency(band.tax)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <footer className="border-4 border-[var(--border)] bg-[var(--surface)] p-6 text-xs uppercase shadow-[6px_6px_0_var(--shadow)]">
          <p>
            This tool is an educational helper and does not replace advice from
            a licensed tax consultant. For precise compliance, review the latest
            Directorate General of Taxes regulations.
          </p>
        </footer>
      </div>
    </div>
  );
}
