import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Save, Loader2, HelpCircle } from 'lucide-react';

interface Props {
  pageId: string | null;
}

export default function QuestionnaireView({ pageId }: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    api.questionnaires.get(pageId)
      .then(data => {
        setQuestions(data.questions || []);
        setAnswers(data.answers || {});
      })
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [pageId]);

  const handleSave = async () => {
    if (!pageId) return;
    setSaving(true);
    try {
      await api.questionnaires.saveAnswers(pageId, answers);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setAnswer = (idx: number, value: string) => {
    setAnswers(prev => ({ ...prev, [`q${idx + 1}`]: value }));
  };

  if (!pageId) {
    return (
      <div className="p-12 text-center">
        <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Select a page to view its questionnaire</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A9EF2]" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-12 text-center">
        <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No questions generated for this page type</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {questions.map((q, i) => (
        <div key={i}>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            {i + 1}. {q}
          </label>
          <textarea
            value={answers[`q${i + 1}`] || ''}
            onChange={e => setAnswer(i, e.target.value)}
            placeholder="Type your answer..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm resize-none h-20"
          />
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Answers
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
      </div>
    </div>
  );
}