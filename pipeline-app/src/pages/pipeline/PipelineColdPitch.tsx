import { Link } from 'react-router-dom';
import { Send, Clock } from 'lucide-react';

export default function PipelineColdPitch() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <Send className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Cold Pitch Builder</h2>
        <p className="text-slate-500 mb-6">Enter a prospect's URL and our AI will analyze their website for speed, layout, and SEO flaws — then generate a custom teardown report with a cold email script ready to send. This feature is coming soon.</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-sm font-medium mb-6"><Clock className="w-4 h-4" />Coming Soon</div>
        <Link to="/pipeline/dashboard" className="text-sm text-[#1A9EF2] font-semibold hover:text-[#4551D3]">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
