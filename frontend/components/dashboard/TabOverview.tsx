'use client';

import { useEffect, useState } from 'react';
import { XCircle, AlertTriangle, CheckCircle2, Save, Check, Pencil } from 'lucide-react';
import { getBudgetAnalysis, runSimulation } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { FullProfile, BudgetAnalysisResult, SimulationResult, Expense } from '@/lib/types';
import { lifestyleTotalMonthly } from '@/lib/types';
import CashFlowBar from '@/components/charts/CashFlowBar';
import careerPaths from '@/data/career_paths.json';
import type { CareerPaths } from '@/lib/types';

const careers = careerPaths as CareerPaths;

function buildSalaryProgression(profile: FullProfile['profile']) {
  if (profile.salary_progression && profile.salary_progression.length > 0) {
    return profile.salary_progression.map((sp) => ({ age: sp.age, salary: sp.salary }));
  }
  const path = careers[profile.career_path];
  if (!path) return [{ age: profile.current_age, salary: profile.annual_salary }];
  return path.progression.map((level) => ({
    age: profile.current_age + level.years_range[0],
    salary: level.median,
  }));
}

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Rent / Housing',
  car_payment: 'Car Payment',
  groceries: 'Groceries',
  dining: 'Dining Out',
  subscriptions: 'Subscriptions',
  utilities: 'Utilities',
  insurance: 'Insurance',
};

interface Props {
  data: FullProfile;
  onSaved: () => void;
}

export default function TabOverview({ data, onSaved }: Props) {
  const [budget, setBudget] = useState<BudgetAnalysisResult | null>(null);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable expenses
  const [editingExpenses, setEditingExpenses] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<Record<string, number>>({});
  const [savingExpenses, setSavingExpenses] = useState(false);

  const { profile, expenses, debts, assets, retirementLifestyles } = data;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalDebtPayments = debts.reduce((s, d) => s + d.min_payment, 0);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const surplus = profile.monthly_take_home - totalExpenses - totalDebtPayments;

  // Build expense map for editing
  useEffect(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    setExpenseDraft(map);
  }, [expenses]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const expenseMap: Record<string, number> = {};
        expenses.forEach((e) => { expenseMap[e.category] = (expenseMap[e.category] || 0) + e.amount; });

        const [budgetRes, simRes] = await Promise.all([
          getBudgetAnalysis({
            monthly_take_home: profile.monthly_take_home,
            expenses: expenseMap,
            total_debt_payments: totalDebtPayments,
            total_monthly_expenses: totalExpenses,
          }),
          runSimulation({
            current_age: profile.current_age,
            retirement_target_age: profile.retirement_target_age,
            annual_salary: profile.annual_salary,
            salary_progression: buildSalaryProgression(profile),
            monthly_expenses: totalExpenses,
            monthly_debt_payments: totalDebtPayments,
            total_debt: totalDebt,
            current_assets: {
              retirement_accounts: assets.filter((a) => ['401k', 'roth_ira'].includes(a.type)).reduce((s, a) => s + a.balance, 0),
              taxable: assets.filter((a) => a.type === 'brokerage').reduce((s, a) => s + a.balance, 0),
              savings: assets.filter((a) => a.type === 'savings').reduce((s, a) => s + a.balance, 0),
            },
            monthly_savings_rate: Math.max(0, surplus),
            employer_match_pct: profile.employer_match_pct,
            safe_withdrawal_rate: profile.safe_withdrawal_rate,
            goal_monthly_retirement_income: retirementLifestyles?.goal
              ? lifestyleTotalMonthly(retirementLifestyles.goal)
              : profile.desired_monthly_retirement_income || 5000,
            predicted_monthly_retirement_income: retirementLifestyles?.predicted
              ? lifestyleTotalMonthly(retirementLifestyles.predicted)
              : (profile.desired_monthly_retirement_income || 5000) * 0.7,
          }),
        ]);

        setBudget(budgetRes as BudgetAnalysisResult);
        setSim(simRes as SimulationResult);
      } catch (err) {
        console.error('Failed to load overview data:', err);
      }
      setLoading(false);
    }
    fetchData();
  }, [data]);

  const handleSaveExpenses = async () => {
    setSavingExpenses(true);
    try {
      // Update each expense in Supabase
      for (const exp of expenses) {
        const newAmount = expenseDraft[exp.category];
        if (newAmount !== undefined && newAmount !== exp.amount) {
          await supabase
            .from('expenses')
            .update({ amount: newAmount })
            .eq('id', exp.id);
        }
      }
      setEditingExpenses(false);
      onSaved(); // reload profile
    } catch (err) {
      console.error('Failed to save expenses:', err);
    }
    setSavingExpenses(false);
  };

  if (loading) {
    return <div className="animate-pulse text-gray-400 py-12 text-center">Calculating your overview...</div>;
  }

  const score = sim?.retirement_readiness_score ?? 0;
  const scoreColor = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = score >= 70 ? 'bg-green-50 border-green-200' : score >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  // Group expenses by category for display
  const expenseCategories = Object.entries(expenseDraft).sort((a, b) => b[1] - a[1]);
  const draftTotal = Object.values(expenseDraft).reduce((s, v) => s + v, 0);
  const draftSurplus = profile.monthly_take_home - draftTotal - totalDebtPayments;

  return (
    <div className="space-y-6">
      {/* Score + FIRE Summary Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className={`rounded-xl border-2 p-6 text-center ${scoreBg}`}>
          <p className="text-sm font-medium text-gray-600 mb-2">Retirement Readiness Score</p>
          <p className={`text-6xl font-bold ${scoreColor}`}>{score}</p>
          <p className="text-sm text-gray-500 mt-1">out of 100</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-4">FIRE Timeline</p>
          {sim && (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-amber-50">
                <p className="text-xs text-amber-600 font-medium">Goal Lifestyle</p>
                <p className={`text-2xl font-bold ${sim.fire_milestones.goal_achievable ? 'text-gray-900' : 'text-gray-300'}`}>
                  {sim.fire_milestones.goal_achievable && sim.fire_milestones.goal_fire_age
                    ? `Retire at ${sim.fire_milestones.goal_fire_age}`
                    : 'N/A'}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-xs text-blue-600 font-medium">Predicted Lifestyle</p>
                <p className={`text-2xl font-bold ${sim.fire_milestones.predicted_achievable ? 'text-gray-900' : 'text-gray-300'}`}>
                  {sim.fire_milestones.predicted_achievable && sim.fire_milestones.predicted_fire_age
                    ? `Retire at ${sim.fire_milestones.predicted_fire_age}`
                    : 'N/A'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts — FIRST */}
      {budget && budget.alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-4">Alerts</p>
          <div className="space-y-2">
            {budget.alerts.filter(a => a.severity !== 'green').slice(0, 5).map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  alert.severity === 'red'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                {alert.severity === 'red' ? (
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-gray-700">{alert.message}</p>
              </div>
            ))}
            {budget.alerts.filter(a => a.severity === 'green').length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  {budget.alerts.filter(a => a.severity === 'green').length} categories within budget
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Granular Monthly Spending — EDITABLE */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-600">Monthly Spending Breakdown</p>
          <div className="flex items-center gap-2">
            {editingExpenses ? (
              <>
                <button
                  onClick={() => {
                    // Reset to original
                    const map: Record<string, number> = {};
                    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
                    setExpenseDraft(map);
                    setEditingExpenses(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveExpenses}
                  disabled={savingExpenses}
                  className="flex items-center gap-1 text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {savingExpenses ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditingExpenses(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {expenseCategories.map(([category, amount]) => {
            const benchmark = budget?.benchmarks.find((b) => b.category === category);
            const pct = profile.monthly_take_home > 0 ? ((amount / profile.monthly_take_home) * 100).toFixed(1) : '0';
            const label = CATEGORY_LABELS[category] || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            return (
              <div key={category} className="flex items-center gap-3">
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  benchmark?.status === 'red' ? 'bg-red-500' :
                  benchmark?.status === 'yellow' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`} />

                {/* Label */}
                <span className="text-sm text-gray-700 w-36">{label}</span>

                {/* Amount — editable or display */}
                {editingExpenses ? (
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      value={expenseDraft[category] || 0}
                      onChange={(e) => setExpenseDraft({ ...expenseDraft, [category]: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg pl-5 pr-2 py-1 text-sm text-right"
                    />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-gray-900 w-28 text-right">
                    ${amount.toLocaleString()}
                  </span>
                )}

                {/* % of income */}
                <span className="text-xs text-gray-400 w-14 text-right">{pct}%</span>

                {/* Visual bar */}
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      benchmark?.status === 'red' ? 'bg-red-400' :
                      benchmark?.status === 'yellow' ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`}
                    style={{ width: `${Math.min(100, Number(pct) * 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-xs text-gray-500">Expenses</span>
              <p className="text-sm font-semibold text-gray-900">${(editingExpenses ? draftTotal : totalExpenses).toLocaleString()}/mo</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Debt Payments</span>
              <p className="text-sm font-semibold text-orange-600">${totalDebtPayments.toLocaleString()}/mo</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Take-Home</span>
              <p className="text-sm font-semibold text-gray-900">${profile.monthly_take_home.toLocaleString()}/mo</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500">{(editingExpenses ? draftSurplus : surplus) >= 0 ? 'Surplus' : 'Deficit'}</span>
            <p className={`text-lg font-bold ${(editingExpenses ? draftSurplus : surplus) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(editingExpenses ? draftSurplus : surplus) >= 0 ? '' : '-'}${Math.abs(editingExpenses ? draftSurplus : surplus).toLocaleString()}/mo
            </p>
          </div>
        </div>
      </div>

      {/* Cash Flow Visualization — LAST */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm font-medium text-gray-600 mb-4">Where Your Paycheck Goes</p>
        <CashFlowBar
          income={profile.monthly_take_home}
          expenses={editingExpenses ? draftTotal : totalExpenses}
          debtPayments={totalDebtPayments}
          surplus={editingExpenses ? draftSurplus : surplus}
        />
      </div>
    </div>
  );
}
