import { useState } from "react";

const WithdrawSection = () => {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");

  const handleWithdrawSubmit = (event) => {
    event.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!withdrawAmount || Number.isNaN(amount) || amount <= 0) {
      setWithdrawError("Please enter a valid withdrawal amount.");
      return;
    }
    setWithdrawError("");
    window.alert(`Withdrawal request submitted for ₹${amount.toFixed(2)}.`);
    setWithdrawAmount("");
    setWithdrawOpen(false);
  };

  return (
    <section className="my-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
            Withdrawal
          </p>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            Request a payout
          </h2>
        </div>
        <button
          onClick={() => setWithdrawOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-full bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#c8880f]"
        >
          {withdrawOpen ? "Close" : "Withdraw"}
        </button>
      </div>

      {withdrawOpen && (
        <form
          onSubmit={handleWithdrawSubmit}
          className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8"
        >
          <label className="block text-sm font-medium text-slate-700">
            Enter amount to withdraw
            <input
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              type="number"
              min="1"
              step="0.01"
              placeholder="50.00"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-900 shadow-sm outline-none transition focus:border-[#E8A020]"
            />
          </label>
          {withdrawError && (
            <p className="text-sm text-red-600">{withdrawError}</p>
          )}
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Submit Request
          </button>
        </form>
      )}
    </section>
  );
};

export default WithdrawSection;
