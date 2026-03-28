'use client';

import { useEffect, useState, useCallback } from 'react';
import { runSimulation } from '@/lib/api';
import type { FullProfile, SimulationResult, NeverRetireAnalysis, Profile } from '@/lib/types';
import { lifestyleTotalMonthly } from '@/lib/types';
import { AlertTriangle, TrendingUp, Scissors, DollarSign, ArrowRight } from 'lucide-react';
import FanChart from '@/components/charts/FanChart';
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

function NeverRetireSection({ analysis, profile }: { analysis: NeverRetireAnalysis | null; profile: Profile }) {
  if (!analysis) {
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-lg font-semibold text-red-800 mb-1">Retirement is not achievable</p>
        <p className="text-sm text-red-600">
          On your current trajectory, you won&apos;t accumulate enough to retire at either lifestyle level.
          Use the What If sliders below to explore changes.
        </p>
      </div>
    );
  }

  const { peak_net_worth, peak_age, monthly_surplus, predicted_target, shortfall } = analysis;

  const options = [
    analysis.extra_savings_needed && {
      icon: DollarSign,
      color: 'emerald',
      title: `Save $${analysis.extra_savings_needed.toLocaleString()} more per month`,
      desc: `Putting aside an extra $${analysis.extra_savings_needed}/mo — through a side gig, automated transfers, or cutting discretionary spending — could let you retire at ${analysis.extra_savings_retire_age}.`,
      age: analysis.extra_savings_retire_age,
    },
    analysis.expense_cut_needed && {
      icon: Scissors,
      color: 'blue',
      title: `Cut $${analysis.expense_cut_needed.toLocaleString()}/mo from expenses`,
      desc: `Reducing your monthly expenses by $${analysis.expense_cut_needed} (e.g., cheaper housing, cooking more, fewer subscriptions) lowers both your current burn and your retirement target — potentially retiring at ${analysis.expense_cut_retire_age}.`,
      age: analysis.expense_cut_retire_age,
    },
    analysis.income_boost_needed && {
      icon: TrendingUp,
      color: 'purple',
      title: `Earn $${analysis.income_boost_needed.toLocaleString()}/yr more`,
      desc: `A $${(analysis.income_boost_needed / 1000).toFixed(0)}k salary bump — through a promotion, job switch, or additional certification — could put retirement at ${analysis.income_boost_retire_age} within reach.`,
      age: analysis.income_boost_retire_age,
    },
  ].filter(Boolean) as { icon: any; color: string; title: string; desc: string; age: number | null }[];

  const colorClasses: Record<string, { bg: string; border: string; icon: string; title: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-300', icon: 'text-emerald-600', title: 'text-emerald-800' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-300', icon: 'text-blue-600', title: 'text-blue-800' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-300', icon: 'text-purple-600', title: 'text-purple-800' },
  };

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-lg font-semibold text-red-800 mb-2">
              Retirement is not achievable on your current path
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mt-3">
              <div>
                <p className="text-xs text-red-500">Peak net worth</p>
                <p className="text-xl font-bold text-red-800">${(peak_net_worth / 1000).toFixed(0)}k</p>
                <p className="text-xs text-red-400">at age {peak_age}</p>
              </div>
              <div>
                <p className="text-xs text-red-500">Target needed</p>
                <p className="text-xl font-bold text-red-800">${(predicted_target / 1000).toFixed(0)}k</p>
                <p className="text-xs text-red-400">for predicted lifestyle</p>
              </div>
              <div>
                <p className="text-xs text-red-500">Shortfall</p>
                <p className="text-xl font-bold text-red-800">${(shortfall / 1000).toFixed(0)}k</p>
                <p className="text-xs text-red-400">
                  {monthly_surplus < 0
                    ? `currently -$${Math.abs(monthly_surplus).toFixed(0)}/mo deficit`
                    : `only $${monthly_surplus.toFixed(0)}/mo surplus`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable options */}
      {options.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Here&apos;s what could change that:</h4>
          <div className="space-y-3">
            {options.map((opt, i) => {
              const c = colorClasses[opt.color];
              return (
                <div key={i} className={`rounded-xl border-2 p-5 ${c.bg} ${c.border}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${c.bg}`}>
                      <opt.icon className={`w-5 h-5 ${c.icon}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`font-semibold ${c.title}`}>{opt.title}</p>
                        {opt.age && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.bg} ${c.title} border ${c.border}`}>
                            Retire at {opt.age}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{opt.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {options.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-700">
            The gap is significant. Consider combining multiple strategies — increasing income, reducing
            expenses, and boosting savings simultaneously. Use the What If sliders below to model scenarios.
          </p>
        </div>
      )}
    </div>
  );
}

export default function TabFire({ data }: { data: FullProfile }) {
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);

  // What-if sliders
  const [extraIncome, setExtraIncome] = useState(0);
  const [extraSavings, setExtraSavings] = useState(0);
  const [retireAge, setRetireAge] = useState(data.profile.retirement_target_age);

  const { profile, expenses, debts, assets, retirementLifestyles } = data;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalDebtPayments = debts.reduce((s, d) => s + d.min_payment, 0);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const surplus = profile.monthly_take_home - totalExpenses - totalDebtPayments;

  // Get retirement income targets from lifestyle data, or fall back to profile defaults
  const goalMonthly = retirementLifestyles?.goal
    ? lifestyleTotalMonthly(retirementLifestyles.goal)
    : profile.desired_monthly_retirement_income || 5000;
  const predictedMonthly = retirementLifestyles?.predicted
    ? lifestyleTotalMonthly(retirementLifestyles.predicted)
    : goalMonthly * 0.7;

  const fetchSimulation = useCallback(async () => {
    setLoading(true);
    try {
      const adjustedSalary = profile.annual_salary + extraIncome;
      const adjustedSavings = Math.max(0, surplus + extraSavings);

      const result = await runSimulation({
        current_age: profile.current_age,
        retirement_target_age: retireAge,
        annual_salary: adjustedSalary,
        salary_progression: buildSalaryProgression(profile).map((sp) => ({
          ...sp,
          salary: sp.salary + extraIncome,
        })),
        monthly_expenses: totalExpenses,
        monthly_debt_payments: totalDebtPayments,
        total_debt: totalDebt,
        current_assets: {
          retirement_accounts: assets.filter((a) => ['401k', 'roth_ira'].includes(a.type)).reduce((s, a) => s + a.balance, 0),
          taxable: assets.filter((a) => a.type === 'brokerage').reduce((s, a) => s + a.balance, 0),
          savings: assets.filter((a) => a.type === 'savings').reduce((s, a) => s + a.balance, 0),
        },
        monthly_savings_rate: adjustedSavings,
        employer_match_pct: profile.employer_match_pct,
        safe_withdrawal_rate: profile.safe_withdrawal_rate,
        goal_monthly_retirement_income: goalMonthly,
        predicted_monthly_retirement_income: predictedMonthly,
      });
      setSim(result as SimulationResult);
    } catch (err) {
      console.error('Simulation failed:', err);
    }
    setLoading(false);
  }, [data, extraIncome, extraSavings, retireAge]);

  useEffect(() => {
    const timeout = setTimeout(fetchSimulation, 500);
    return () => clearTimeout(timeout);
  }, [fetchSimulation]);

  const fm = sim?.fire_milestones;

  return (
    <div className="space-y-8">
      {/* Fan Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Monte Carlo Projection</h3>
        {loading && !sim ? (
          <div className="h-80 flex items-center justify-center text-gray-400 animate-pulse">Running 1,000 simulations...</div>
        ) : sim ? (
          <FanChart data={sim} currentAge={profile.current_age} />
        ) : null}
      </div>

      {/* FIRE Milestones — Goal vs Predicted */}
      {fm && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Goal FIRE */}
          <div className={`rounded-xl border-2 p-6 ${fm.goal_achievable ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-amber-700">Goal Lifestyle FIRE</p>
              <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                ${goalMonthly.toLocaleString()}/mo
              </span>
            </div>
            <p className={`text-4xl font-bold my-2 ${fm.goal_achievable ? 'text-gray-900' : 'text-gray-300'}`}>
              {fm.goal_achievable && fm.goal_fire_age ? `Retire at ${fm.goal_fire_age}` : 'Not achievable'}
            </p>
            <p className="text-xs text-gray-500">
              Target: ${(fm.goal_fire_target / 1_000_000).toFixed(1)}M invested (25x ${(goalMonthly * 12).toLocaleString()}/yr)
            </p>
            {fm.goal_achievable && fm.goal_fire_age && (
              <p className="text-sm text-amber-700 mt-2">
                {fm.goal_fire_age - profile.current_age} years from now
              </p>
            )}
          </div>

          {/* Predicted FIRE */}
          <div className={`rounded-xl border-2 p-6 ${fm.predicted_achievable ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-700">Predicted Lifestyle FIRE</p>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                ${predictedMonthly.toLocaleString()}/mo
              </span>
            </div>
            <p className={`text-4xl font-bold my-2 ${fm.predicted_achievable ? 'text-gray-900' : 'text-gray-300'}`}>
              {fm.predicted_achievable && fm.predicted_fire_age ? `Retire at ${fm.predicted_fire_age}` : 'Not achievable'}
            </p>
            <p className="text-xs text-gray-500">
              Target: ${(fm.predicted_fire_target / 1_000_000).toFixed(1)}M invested (25x ${(predictedMonthly * 12).toLocaleString()}/yr)
            </p>
            {fm.predicted_achievable && fm.predicted_fire_age && (
              <p className="text-sm text-blue-700 mt-2">
                {fm.predicted_fire_age - profile.current_age} years from now
              </p>
            )}
          </div>
        </div>
      )}

      {/* Comparison insight */}
      {fm && fm.goal_achievable && fm.predicted_achievable && fm.goal_fire_age && fm.predicted_fire_age && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-sm text-green-700">
            Your predicted lifestyle lets you retire <strong>{fm.goal_fire_age - fm.predicted_fire_age} years earlier</strong> than
            your goal lifestyle. Adjusting your retirement expectations could mean the difference between retiring at{' '}
            <strong>{fm.predicted_fire_age}</strong> vs <strong>{fm.goal_fire_age}</strong>.
          </p>
        </div>
      )}

      {fm && !fm.goal_achievable && fm.predicted_achievable && fm.predicted_fire_age && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-sm text-yellow-700">
            Your goal lifestyle isn&apos;t achievable on your current trajectory, but your predicted lifestyle
            would let you retire at <strong>{fm.predicted_fire_age}</strong>. Consider adjusting your
            retirement goals on the Retirement Lifestyle tab.
          </p>
        </div>
      )}

      {fm && !fm.goal_achievable && !fm.predicted_achievable && (
        <NeverRetireSection analysis={sim?.never_retire_analysis ?? null} profile={profile} />
      )}

      {/* What-If Sliders */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">What If...?</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Extra annual income: <span className="font-semibold text-blue-600">+${extraIncome.toLocaleString()}/yr</span>
            </label>
            <input type="range" min={0} max={100000} step={5000} value={extraIncome} onChange={(e) => setExtraIncome(Number(e.target.value))} className="w-full accent-blue-600" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Extra monthly savings: <span className="font-semibold text-blue-600">+${extraSavings.toLocaleString()}/mo</span>
            </label>
            <input type="range" min={0} max={3000} step={100} value={extraSavings} onChange={(e) => setExtraSavings(Number(e.target.value))} className="w-full accent-blue-600" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Retire at age: <span className="font-semibold text-blue-600">{retireAge}</span>
            </label>
            <input type="range" min={35} max={70} value={retireAge} onChange={(e) => setRetireAge(Number(e.target.value))} className="w-full accent-blue-600" />
          </div>
        </div>
        {loading && <p className="text-xs text-gray-400 mt-3 animate-pulse">Recalculating...</p>}
      </div>

      {/* Gap Analysis */}
      {sim && sim.gap_analysis?.goal_fire_by_50 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-2">Gap Analysis</h3>
          <p className="text-sm text-gray-600">
            To reach your goal lifestyle FIRE by 50, you&apos;d need to reach a salary of approximately{' '}
            <span className="font-bold">
              ${Object.values(sim.gap_analysis.goal_fire_by_50.required_salary_by_age || {})[1]?.toLocaleString() || 'N/A'}
            </span>{' '}
            by age {Object.keys(sim.gap_analysis.goal_fire_by_50.required_salary_by_age || {})[1] || '?'}.
          </p>
          {sim.gap_analysis.goal_fire_by_50.suggested_roles && (
            <p className="text-sm text-gray-500 mt-2">
              Roles that typically pay this: {sim.gap_analysis.goal_fire_by_50.suggested_roles.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
