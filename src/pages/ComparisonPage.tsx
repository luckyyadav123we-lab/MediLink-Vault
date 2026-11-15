import React, { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface ComparisonResponse {
  available_analytes: Array<{ code: string; name: string; count: number }>;
  selected_code: string;
  units_compatible: boolean;
  units_detected: string[];
  methodology_changed: boolean;
  methods_detected: string[];
  safeguard_warning: string | null;
  series: Array<{
    id: string;
    document_id: string;
    document_title: string;
    test_name: string;
    value_numeric: number;
    value_text: string;
    unit: string;
    ref_low: number | null;
    ref_high: number | null;
    methodology: string;
    lab_name: string;
    observed_at: string;
    flag: string;
  }>;
  delta_summary: {
    from_date: string;
    to_date: string;
    from_value: number;
    to_value: number;
    unit: string;
    absolute_change: number;
    percent_change: number;
    direction: string;
  } | null;
}

export const ComparisonPage: React.FC = () => {
  const { activePatientId, pushToast } = useAuthStore();
  const [selectedCode, setSelectedCode] = useState('HBA1C');
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadComparison = async (code: string) => {
    if (!activePatientId) return;
    setLoading(true);
    try {
      const res = await apiFetch<ComparisonResponse>(
        `/api/records/compare?patient_id=${encodeURIComponent(activePatientId)}&canonical_code=${encodeURIComponent(code)}`
      );
      setData(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load report comparison.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComparison(selectedCode);
  }, [activePatientId, selectedCode]);

  const refLow = data?.series[0]?.ref_low ?? undefined;
  const refHigh = data?.series[0]?.ref_high ?? undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Old vs New Medical Report Comparison</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Longitudinal trend analysis with unit compatibility and laboratory methodology safeguards
        </p>
      </div>

      {/* Analyte Selector */}
      {data && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 me-2">Select Comparable Test:</span>
          {data.available_analytes.map((a) => (
            <button
              key={a.code}
              onClick={() => setSelectedCode(a.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selectedCode === a.code
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {a.name} ({a.count})
            </button>
          ))}
        </div>
      )}

      {loading || !data ? (
        <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <>
          {data.safeguard_warning && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Clinical Normalization Safeguard</p>
                <p className="mt-0.5">{data.safeguard_warning}</p>
              </div>
            </div>
          )}

          {/* Delta KPI Row */}
          {data.delta_summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Earliest Recorded ({data.delta_summary.from_date})</p>
                <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {data.delta_summary.from_value} {data.delta_summary.unit}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Latest Recorded ({data.delta_summary.to_date})</p>
                <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {data.delta_summary.to_value} {data.delta_summary.unit}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Net Change</p>
                <p className="text-xl font-bold font-mono tabular-nums text-teal-800 mt-1 flex items-center gap-1.5">
                  {data.delta_summary.absolute_change < 0 ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <TrendingUp className="w-5 h-5" />
                  )}
                  {data.delta_summary.absolute_change > 0 ? '+' : ''}
                  {data.delta_summary.absolute_change} {data.delta_summary.unit} ({data.delta_summary.percent_change}%)
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Reference Range</p>
                <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {refLow ?? '0'} – {refHigh ?? '—'} {data.delta_summary.unit}
                </p>
              </div>
            </div>
          )}

          {/* Time-Series Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Time-Series Trend · {data.series[0]?.test_name || selectedCode}
              </h2>
              <span className="text-xs text-slate-500">Shaded band indicates lab reference range</span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="observed_at" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  {refLow !== undefined && refHigh !== undefined && (
                    <ReferenceArea y1={refLow} y2={refHigh} fill="#0F766E" fillOpacity={0.08} />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value_numeric"
                    name={data.series[0]?.test_name}
                    stroke="#0F766E"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#0F766E' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Provenance Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4 text-start">Observed Date</th>
                  <th className="py-3 px-4 text-end">Value</th>
                  <th className="py-3 px-4 text-start">Reference Range</th>
                  <th className="py-3 px-4 text-start">Flag</th>
                  <th className="py-3 px-4 text-start">Laboratory & Methodology</th>
                  <th className="py-3 px-4 text-start">Source Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.series.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{row.observed_at}</td>
                    <td className="py-3 px-4 text-end font-mono font-semibold tabular-nums text-slate-900">
                      {row.value_text} {row.unit}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                      {row.ref_low ?? '0'} – {row.ref_high ?? '—'} {row.unit}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold uppercase ${
                          row.flag === 'normal'
                            ? 'text-emerald-800'
                            : row.flag === 'low'
                            ? 'text-amber-800'
                            : 'text-red-700'
                        }`}
                      >
                        {row.flag}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {row.lab_name} · {row.methodology}
                    </td>
                    <td className="py-3 px-4 text-teal-800 font-medium">{row.document_title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
