import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Eye, FileText, Search, Upload, Clock, X, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { formatRegionalDate } from '../i18n';
import { useTranslation } from 'react-i18next';

interface VaultDocument {
  id: string;
  title: string;
  category: string;
  facility_name: string;
  document_date: string;
  mime_type: string;
  file_size_bytes: number;
  sha256_hash: string;
  page_count: number;
  verification_status: string;
  raw_extracted_text: string;
  signed_preview_url: string;
}

export const VaultPage: React.FC = () => {
  const { i18n } = useTranslation();
  const { activePatientId, pushToast } = useAuthStore();
  const [searchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<'vault' | 'timeline'>('vault');
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);
  const [showUpload, setShowUpload] = useState(searchParams.get('upload') === '1');

  // Upload form
  const [title, setTitle] = useState('');
  const [uploadCat, setUploadCat] = useState('lab_report');
  const [facility, setFacility] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadDocs = async () => {
    if (!activePatientId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ patient_id: activePatientId, category, search });
      const res = await apiFetch<{ documents: VaultDocument[] }>(`/api/records?${qs.toString()}`);
      setDocuments(res.documents);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load vault.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [activePatientId, category]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatientId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('patient_id', activePatientId);
      formData.append('title', title);
      formData.append('category', uploadCat);
      formData.append('facility_name', facility || 'Patient Direct Upload');
      formData.append('document_date', docDate);
      formData.append('notes', notes);
      if (file) formData.append('file', file);

      await apiFetch('/api/records/upload', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      pushToast('success', 'Document securely hashed and stored in vault.');
      setTitle('');
      setNotes('');
      setFile(null);
      setShowUpload(false);
      await loadDocs();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Medical Record Vault & Timeline</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SHA-256 duplicate protection · Original documents preserved with source provenance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              onClick={() => setViewMode('vault')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                viewMode === 'vault' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Vault Table
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Chronological Timeline
            </button>
          </div>
          <button
            onClick={() => setShowUpload((s) => !s)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {showUpload && (
        <form onSubmit={handleUpload} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Upload Medical Report / Prescription / DICOM Metadata</h2>
            <button type="button" onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document Title (e.g. Lipid Profile Jan 2026)"
              className="md:col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
            <select
              value={uploadCat}
              onChange={(e) => setUploadCat(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="lab_report">Lab Report</option>
              <option value="prescription">Prescription</option>
              <option value="discharge_summary">Discharge Summary</option>
              <option value="radiology_dicom">Radiology / DICOM</option>
              <option value="consultation_note">Consultation Note</option>
            </select>
            <input
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              placeholder="Issuing Hospital or Laboratory Name"
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,.dcm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50"
            />
          </div>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional clinical text or report summary notes (if uploading without PDF/text file)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-60"
            >
              {uploading ? 'Hashing & Encrypting…' : 'Save to Medical Vault'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadDocs();
          }}
          className="flex-1 min-w-[240px] flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles, hospitals, test names, or medications…"
              className="w-full ps-9 pe-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium">
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'lab_report', label: 'Lab Reports' },
            { id: 'prescription', label: 'Prescriptions' },
            { id: 'discharge_summary', label: 'Discharges' },
            { id: 'radiology_dicom', label: 'Radiology' },
            { id: 'consultation_note', label: 'Consultations' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                category === tab.id
                  ? 'bg-teal-50 border-teal-300 text-teal-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : documents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">No documents match your filter.</p>
          <p className="text-xs text-slate-500">Upload a medical report or switch to "All" categories.</p>
        </div>
      ) : viewMode === 'vault' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                <th className="py-3 px-4 text-start">Document Title</th>
                <th className="py-3 px-4 text-start">Category</th>
                <th className="py-3 px-4 text-start">Issuing Facility</th>
                <th className="py-3 px-4 text-start">Date</th>
                <th className="py-3 px-4 text-start">Provenance</th>
                <th className="py-3 px-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {documents.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{d.title}</td>
                  <td className="py-3 px-4 text-slate-600 capitalize">{d.category.replace('_', ' ')}</td>
                  <td className="py-3 px-4 text-slate-600">{d.facility_name}</td>
                  <td className="py-3 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                    {formatRegionalDate(d.document_date, i18n.language)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-medium capitalize">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {d.verification_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-end whitespace-nowrap space-x-2">
                    <button
                      onClick={() => setPreviewDoc(d)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                    <a
                      href={d.signed_preview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded text-teal-800 hover:bg-teal-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Open Original
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {documents.map((d) => (
            <div key={d.id} className="flex gap-4 items-start border-b border-slate-100 pb-5 last:border-none last:pb-0">
              <div className="w-24 shrink-0 text-xs font-mono text-slate-500 pt-0.5 tabular-nums flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-700" />
                {d.document_date}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{d.title}</h3>
                  <button
                    onClick={() => setPreviewDoc(d)}
                    className="text-xs font-medium text-teal-800 hover:underline"
                  >
                    Inspect Original
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {d.facility_name} · {d.category.replace('_', ' ')} · {d.page_count} page(s)
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Original Report Viewer Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{previewDoc.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {previewDoc.facility_name} · {previewDoc.document_date} · SHA-256: <span className="font-mono">{previewDoc.sha256_hash.slice(0, 12)}…</span>
                </p>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
              {previewDoc.raw_extracted_text}
            </pre>
            <div className="flex justify-end gap-2">
              <a
                href={previewDoc.signed_preview_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800"
              >
                <Download className="w-3.5 h-3.5" />
                Open Signed File URL
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
