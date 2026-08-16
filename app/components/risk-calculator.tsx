"use client";

import { useMemo, useState } from "react";

type Currency = "USD" | "IDR";

const DEFAULT_CAPITAL: Record<Currency, number> = {
  USD: 1000,
  IDR: 15000000,
};

function formatCurrency(value: number, currency: Currency) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

export function RiskCalculator() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const [capital, setCapital] = useState(DEFAULT_CAPITAL.USD);
  const [riskPerTrade, setRiskPerTrade] = useState(2);
  const [riskPerDay, setRiskPerDay] = useState(6);

  function handleCurrencyChange(next: Currency) {
    setCurrency(next);
    setCapital(DEFAULT_CAPITAL[next]);
  }

  const results = useMemo(() => {
    const safeCapital = Number.isFinite(capital) && capital > 0 ? capital : 0;
    const riskPerTradeAmount = (safeCapital * riskPerTrade) / 100;
    const riskPerDayAmount = (safeCapital * riskPerDay) / 100;
    const maxEntriesPerDay = riskPerTrade > 0 ? Math.floor(riskPerDay / riskPerTrade) : 0;
    const lossesToBlow = riskPerTrade > 0 ? Math.ceil(100 / riskPerTrade) : 0;
    const daysToBlow = maxEntriesPerDay > 0 ? Math.ceil(lossesToBlow / maxEntriesPerDay) : null;

    return {
      safeCapital,
      riskPerTradeAmount,
      riskPerDayAmount,
      maxEntriesPerDay,
      lossesToBlow,
      daysToBlow,
    };
  }, [capital, riskPerTrade, riskPerDay]);

  const tradeExceedsDayLimit = riskPerTrade > riskPerDay;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A]">
        Trading Tools
      </p>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
        Risk Calculator
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-[#3C4636] md:text-lg">
        Set your capital and risk limits to see how many trades you can take
        per day, and how many consecutive losses it would take to blow your
        account.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="rounded-[32px] border border-[#E4DDCE] bg-[#FBF8F1] p-6 shadow-[0_18px_54px_rgba(28,37,19,0.08)] sm:p-8">
          <div>
            <label className="text-sm font-bold text-[#102016]">Capital</label>
            <div className="mt-3 flex items-stretch gap-2">
              <div className="flex shrink-0 overflow-hidden rounded-2xl border border-[#E4DDCE] bg-white">
                {(["USD", "IDR"] as Currency[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleCurrencyChange(option)}
                    className={`px-4 py-3 text-sm font-bold whitespace-nowrap transition ${
                      currency === option
                        ? "bg-[#365C2A] text-[#F8F4EC]"
                        : "text-[#3C4636] hover:bg-[#EFE9DA]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={capital}
                onChange={(event) => setCapital(Number(event.target.value))}
                className="w-full rounded-2xl border border-[#E4DDCE] bg-white px-4 py-3 text-sm font-semibold text-[#102016] outline-none focus:border-[#365C2A]"
                placeholder={`e.g. ${DEFAULT_CAPITAL[currency]}`}
              />
            </div>
          </div>

          <SliderField
            label="Risk per Trade"
            value={riskPerTrade}
            onChange={setRiskPerTrade}
            hint={formatCurrency(results.riskPerTradeAmount, currency)}
          />

          <SliderField
            label="Risk per Day"
            value={riskPerDay}
            onChange={setRiskPerDay}
            hint={formatCurrency(results.riskPerDayAmount, currency)}
          />

          {tradeExceedsDayLimit ? (
            <p className="mt-6 rounded-2xl border border-[#E9C9A6] bg-[#FBF1E4] px-4 py-3 text-sm font-medium leading-6 text-[#8A5A20]">
              Risk per trade is higher than your daily risk limit, so you
              can&apos;t take a single full-size trade without breaching your
              daily limit. Lower the risk per trade or raise the daily limit.
            </p>
          ) : null}
        </div>

        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Risk / Trade" value={formatCurrency(results.riskPerTradeAmount, currency)} sub={`${riskPerTrade}% of capital`} />
            <StatCard label="Risk / Day" value={formatCurrency(results.riskPerDayAmount, currency)} sub={`${riskPerDay}% of capital`} />
          </div>

          <div className="rounded-[32px] bg-[#102016] p-6 text-[#F8F4EC] shadow-[0_18px_54px_rgba(28,37,19,0.18)] sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DDE7C8]">
              Max Entries per Day
            </p>
            <p className="mt-3 text-5xl font-extrabold leading-none sm:text-6xl">
              {results.maxEntriesPerDay}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#D5D1C5]">
              Number of full-size trades you can take before hitting your
              daily risk limit, assuming every trade loses.
            </p>
          </div>

          <div className="rounded-[32px] border border-[#E4DDCE] bg-[#FBF8F1] p-6 shadow-[0_18px_54px_rgba(28,37,19,0.08)] sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A]">
              Margin Call Scenario
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-extrabold text-[#102016] sm:text-4xl">
                  {results.lossesToBlow}
                </p>
                <p className="mt-1 text-sm font-medium text-[#3C4636]">
                  consecutive losing trades
                </p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-[#102016] sm:text-4xl">
                  {results.daysToBlow ?? "—"}
                </p>
                <p className="mt-1 text-sm font-medium text-[#3C4636]">
                  trading days
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-8 max-w-3xl text-xs leading-6 text-[#8D8A80]">
        Estimates assume worst case (every trade in the sequence is a loss)
        and risk % calculated from your starting capital. This is an
        educational estimate, not financial advice — actual results depend on
        your broker, leverage, and execution.
      </p>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint: string;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-[#102016]">{label}</label>
        <span className="rounded-full bg-[#365C2A] px-3 py-1 text-xs font-extrabold text-[#F8F4EC]">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-4 w-full accent-[#365C2A]"
      />
      <div className="mt-1 flex items-center justify-between text-xs font-medium text-[#8D8A80]">
        <span>1%</span>
        <span className="text-[#3C4636]">{hint}</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[24px] border border-[#E4DDCE] bg-white p-5 shadow-[0_12px_36px_rgba(28,37,19,0.06)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8D8A80]">
        {label}
      </p>
      <p className="mt-2 text-xl font-extrabold text-[#102016] sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs font-medium text-[#3C4636]">{sub}</p>
    </div>
  );
}
