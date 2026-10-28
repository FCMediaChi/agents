import { useState, useEffect } from 'react';
import { Users, Palette, Plus, Trash2, Save, Loader2, Check, Key, Copy, Globe, Shield } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

interface WhitelabelSettings {
  enabled: boolean;
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<'team' | 'whitelabel' | 'blueprintwl' | 'apikeys' | 'domains'>('team');

  // Team state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [maxSeats, setMaxSeats] = useState(1);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [teamLoading, setTeamLoading] = useState(true);

  // Whitelabel state
  const [wlSettings, setWlSettings] = useState<WhitelabelSettings>({
    enabled: false, companyName: '', logoUrl: '', primaryColor: '#1A9EF2', secondaryColor: '#4551D3'
  });
  const [wlLoading, setWlLoading] = useState(false);
  const [wlSaved, setWlSaved] = useState(false);
  const [wlError, setWlError] = useState('');

  // Blueprint whitelabel state
  const [bpSettings, setBpSettings] = useState<WhitelabelSettings>({ enabled: false, companyName: '', logoUrl: '', primaryColor: '#1A9EF2', secondaryColor: '#4551D3' });
  const [bpLoading, setBpLoading] = useState(false);
  const [bpSaved, setBpSaved] = useState(false);
  const [bpError, setBpError] = useState('');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Domains state
  const [domains, setDomains] = useState<any[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');

  const loadTeam = async () => {
    try {
      setTeamLoading(true);
      const res = await fetch('/api/account/team', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members || []);
        setMaxSeats(data.maxSeats || 1);
      }
    } catch { /* ignore */ }
    finally { setTeamLoading(false); }
  };

  const loadWhitelabel = async () => {
    try {
      const res = await fetch('/api/account/whitelabel', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setWlSettings(data);
    } catch { /* ignore */ }
  };

  const loadApiKeys = async () => {
    setKeysLoading(true);
    try {
      const res = await fetch('/api/account/api-keys', { credentials: 'include' });
      const data = await res.json();
      setApiKeys(data.keys || []);
    } catch { /* ignore */ }
    finally { setKeysLoading(false); }
  };

  const loadDomains = async () => {
    setDomainsLoading(true);
    try {
      const res = await fetch('/api/account/domains', { credentials: 'include' });
      const data = await res.json();
      setDomains(data.domains || []);
    } catch {}
    finally { setDomainsLoading(false); }
  };

  const loadBpWhitelabel = async () => {
    try {
      const res = await fetch('/api/account/blueprint-whitelabel', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setBpSettings(data);
    } catch {}
  };

  useEffect(() => { loadTeam(); loadWhitelabel(); loadBpWhitelabel(); loadApiKeys(); loadDomains(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);
    try {
      const res = await fetch('/api/account/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error || 'Failed to invite'); return; }
      setInviteEmail('');
      loadTeam();
    } catch { setInviteError('Network error'); }
    finally { setInviteLoading(false); }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    try {
      await fetch(`/api/account/team/${memberId}`, { method: 'DELETE', credentials: 'include' });
      loadTeam();
    } catch { /* ignore */ }
  };

  const handleGenerateKey = async () => {
    setKeyError(''); setGeneratedKey('');
    try {
      const res = await fetch('/api/account/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newKeyName || undefined }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setKeyError(data.error); return; }
      setGeneratedKey(data.key); setNewKeyName(''); loadApiKeys();
    } catch { setKeyError('Network error'); }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Revoke this API key?')) return;
    try { await fetch(`/api/account/api-keys/${id}`, { method: 'DELETE', credentials: 'include' }); loadApiKeys(); } catch {}
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setDomainError('');
    try {
      const res = await fetch('/api/account/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: newDomain }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setDomainError(data.error); return; }
      setDomains([...domains, data]); setNewDomain('');
    } catch { setDomainError('Network error'); }
  };

  const handleVerifyDomain = async (id: string) => {
    try {
      await fetch(`/api/account/domains/${id}/verify`, { method: 'POST', credentials: 'include' });
      loadDomains();
    } catch {}
  };

  const handleRemoveDomain = async (id: string) => {
    if (!confirm('Remove this domain?')) return;
    try { await fetch(`/api/account/domains/${id}`, { method: 'DELETE', credentials: 'include' }); loadDomains(); } catch {}
  };

  const handleBpSave = async (e: React.FormEvent) => {
    e.preventDefault(); setBpError(''); setBpSaved(false); setBpLoading(true);
    try {
      const res = await fetch('/api/account/blueprint-whitelabel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bpSettings), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setBpError(data.error || 'Failed to save'); return; }
      setBpSaved(true); setTimeout(() => setBpSaved(false), 3000);
    } catch { setBpError('Network error'); }
    finally { setBpLoading(false); }
  };

  const handleWhitelabelSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setWlError('');
    setWlSaved(false);
    setWlLoading(true);
    try {
      const res = await fetch('/api/account/whitelabel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wlSettings),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setWlError(data.error || 'Failed to save'); return; }
      setWlSaved(true);
      setTimeout(() => setWlSaved(false), 3000);
    } catch { setWlError('Network error'); }
    finally { setWlLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">Account Settings</h1>
          <p className="text-slate-500 mt-1">Manage your team and branding</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white rounded-xl border border-slate-200 p-1.5">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'team' ? 'bg-[#1A9EF2] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Team Management
          </button>
          <button
            onClick={() => setActiveTab('whitelabel')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'whitelabel' ? 'bg-[#1A9EF2] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-4 h-4" /> White-Label (Audit)
          </button>
          <button
            onClick={() => setActiveTab('blueprintwl')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'blueprintwl' ? 'bg-[#1A9EF2] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-4 h-4" /> Blueprint Branding
          </button>
          <button
            onClick={() => setActiveTab('apikeys')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'apikeys' ? 'bg-[#1A9EF2] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-4 h-4" /> API Keys
          </button>
          <button
            onClick={() => setActiveTab('domains')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'domains' ? 'bg-[#1A9EF2] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4" /> Domains
          </button>
        </div>

        {/* Team Management */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Team Members</h2>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  members.length >= maxSeats ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {members.length} / {maxSeats} seats used
                </span>
              </div>

              {teamLoading ? (
                <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#1A9EF2] mx-auto" /></div>
              ) : members.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No team members yet. Invite someone to get started.</p>
              ) : (
                <div className="space-y-2 mb-6">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#C3E8FF] flex items-center justify-center text-[#1A9EF2] font-bold text-sm">
                          {m.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{m.email}</p>
                          <p className="text-xs text-slate-400">
                            {m.role} · {m.status === 'invited' ? 'Invited' : 'Active'} · {new Date(m.invited_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleRemove(m.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleInvite} className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
                  placeholder="colleague@example.com"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm"
                  disabled={inviteLoading}
                />
                <button
                  type="submit"
                  disabled={inviteLoading || !inviteEmail.trim() || members.length >= maxSeats}
                  className="px-5 py-2.5 rounded-xl font-bold bg-[#1A9EF2] hover:bg-[#4551D3] disabled:bg-slate-300 text-white text-sm transition-all flex items-center gap-2"
                >
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Invite
                </button>
              </form>
              {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
              {members.length >= maxSeats && (
                <p className="mt-2 text-xs text-amber-600">Seat limit reached. Upgrade to Agency for unlimited seats.</p>
              )}
            </div>
          </div>
        )}

        {/* White-Label Settings */}
        {activeTab === 'whitelabel' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">White-Label Settings</h2>
            <form onSubmit={handleWhitelabelSave} className="space-y-5">
              {/* Enable toggle */}
              <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <div>
                  <span className="font-semibold text-slate-800 text-sm">Enable White-Label</span>
                  <p className="text-xs text-slate-400 mt-0.5">Replace Nuria branding on audit reports</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWlSettings({ ...wlSettings, enabled: !wlSettings.enabled })}
                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${wlSettings.enabled ? 'bg-[#1A9EF2]' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${wlSettings.enabled ? 'translate-x-6' : ''}`} />
                </button>
              </label>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={wlSettings.companyName}
                  onChange={(e) => setWlSettings({ ...wlSettings, companyName: e.target.value })}
                  placeholder="Your Agency Name"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Logo URL</label>
                <input
                  type="text"
                  value={wlSettings.logoUrl}
                  onChange={(e) => setWlSettings({ ...wlSettings, logoUrl: e.target.value })}
                  placeholder="https://your-cdn.com/logo.png"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Primary Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={wlSettings.primaryColor}
                      onChange={(e) => setWlSettings({ ...wlSettings, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={wlSettings.primaryColor}
                      onChange={(e) => setWlSettings({ ...wlSettings, primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-[#1A9EF2] outline-none text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Secondary Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={wlSettings.secondaryColor}
                      onChange={(e) => setWlSettings({ ...wlSettings, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={wlSettings.secondaryColor}
                      onChange={(e) => setWlSettings({ ...wlSettings, secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-[#1A9EF2] outline-none text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {wlError && <p className="text-sm text-red-600">{wlError}</p>}
              {wlSaved && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Settings saved successfully
                </p>
              )}

              <button
                type="submit"
                disabled={wlLoading}
                className="w-full py-3 rounded-xl font-bold bg-[#1A9EF2] hover:bg-[#4551D3] disabled:bg-slate-300 text-white text-sm transition-all flex items-center justify-center gap-2"
              >
                {wlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </form>
          </div>
        )}

        {/* Blueprint White-Label */}
        {activeTab === 'blueprintwl' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Blueprint Branding</h2>
            <p className="text-xs text-slate-500 mb-4">Customize branding on proposals, HTML exports, and client portals. Agency tier only.</p>
            <form onSubmit={handleBpSave} className="space-y-5">
              <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <div><span className="font-semibold text-slate-800 text-sm">Enable Branding</span><p className="text-xs text-slate-400 mt-0.5">Replace Nuria branding on Blueprint outputs</p></div>
                <button type="button" onClick={() => setBpSettings({ ...bpSettings, enabled: !bpSettings.enabled })}
                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${bpSettings.enabled ? 'bg-[#1A9EF2]' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${bpSettings.enabled ? 'translate-x-6' : ''}`} />
                </button>
              </label>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name</label>
                <input type="text" value={bpSettings.companyName} onChange={e => setBpSettings({ ...bpSettings, companyName: e.target.value })}
                  placeholder="Your Agency" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#1A9EF2] outline-none text-sm" /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Logo URL</label>
                <input type="text" value={bpSettings.logoUrl} onChange={e => setBpSettings({ ...bpSettings, logoUrl: e.target.value })}
                  placeholder="https://cdn.yourdomain.com/logo.png" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#1A9EF2] outline-none text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Primary Color</label>
                  <div className="flex gap-2"><input type="color" value={bpSettings.primaryColor} onChange={e => setBpSettings({ ...bpSettings, primaryColor: e.target.value })} className="w-10 h-10 rounded-lg border cursor-pointer" />
                    <input type="text" value={bpSettings.primaryColor} onChange={e => setBpSettings({ ...bpSettings, primaryColor: e.target.value })} className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-[#1A9EF2] outline-none text-sm font-mono" /></div></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Secondary Color</label>
                  <div className="flex gap-2"><input type="color" value={bpSettings.secondaryColor} onChange={e => setBpSettings({ ...bpSettings, secondaryColor: e.target.value })} className="w-10 h-10 rounded-lg border cursor-pointer" />
                    <input type="text" value={bpSettings.secondaryColor} onChange={e => setBpSettings({ ...bpSettings, secondaryColor: e.target.value })} className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-[#1A9EF2] outline-none text-sm font-mono" /></div></div>
              </div>
              {bpError && <p className="text-sm text-red-600">{bpError}</p>}
              {bpSaved && <p className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</p>}
              <button type="submit" disabled={bpLoading}
                className="w-full py-3 rounded-xl font-bold bg-[#1A9EF2] hover:bg-[#4551D3] disabled:bg-slate-300 text-white text-sm flex items-center justify-center gap-2">
                {bpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings</button>
            </form>
          </div>
        )}

        {/* API Keys */}
        {activeTab === 'apikeys' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">API Keys</h2>
            <p className="text-xs text-slate-500 mb-4">Use API keys to access Nuria Website Blueprint programmatically. Agency tier only.</p>

            <form onSubmit={e => { e.preventDefault(); handleGenerateKey(); }} className="flex gap-2 mb-4">
              <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (optional)" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1A9EF2] outline-none" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#1A9EF2] text-white text-sm font-semibold hover:bg-[#4551D3] transition-all whitespace-nowrap">
                Generate Key
              </button>
            </form>
            {keyError && <p className="text-xs text-red-500 mb-2">{keyError}</p>}
            {generatedKey && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-1">Copy this key now — it won't be shown again:</p>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-amber-200 text-xs font-mono break-all">{generatedKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(generatedKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 3000); }}
                    className="px-3 py-2 rounded-lg bg-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-300 transition-all flex items-center gap-1 whitespace-nowrap">
                    {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copiedKey ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {keysLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#1A9EF2] mx-auto" />
            ) : apiKeys.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No API keys yet. Generate one above.</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((k: any) => (
                  <div key={k.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{k.name}</p>
                      <p className="text-xs text-slate-400">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at ? ` · Used ${new Date(k.last_used_at).toLocaleDateString()}` : ''}</p>
                    </div>
                    <button onClick={() => handleRevokeKey(k.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Domains */}
        {activeTab === 'domains' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Custom Domains</h2>
            <p className="text-xs text-slate-500 mb-4">Set up a custom domain for client portals and proposal links. Agency tier only.</p>

            <form onSubmit={handleAddDomain} className="flex gap-2 mb-4">
              <input type="text" value={newDomain} onChange={e => { setNewDomain(e.target.value); setDomainError(''); }}
                placeholder="yourdomain.com" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1A9EF2] outline-none" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#1A9EF2] text-white text-sm font-semibold hover:bg-[#4551D3] transition-all whitespace-nowrap">
                Add Domain
              </button>
            </form>
            {domainError && <p className="text-xs text-red-500 mb-2">{domainError}</p>}

            {domainsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#1A9EF2] mx-auto" />
            ) : domains.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No domains configured yet.</p>
            ) : (
              <div className="space-y-3">
                {domains.map((d: any) => (
                  <div key={d.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[#1A9EF2]" />
                        <span className="font-semibold text-slate-800">{d.domain}</span>
                        {d.verified ? (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold"><Shield className="w-3 h-3 inline mr-0.5" /> Verified</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Unverified</span>
                        )}
                      </div>
                      <button onClick={() => handleRemoveDomain(d.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {!d.verified && (
                      <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                        <p className="font-semibold text-amber-800 mb-1">Verify your domain:</p>
                        <p className="text-amber-700 mb-2">Add this TXT record to your DNS:</p>
                        <code className="block px-2 py-1.5 rounded bg-white border border-amber-200 font-mono text-amber-800 break-all mb-2">{d.verification_token}</code>
                        <button onClick={() => handleVerifyDomain(d.id)}
                          className="px-3 py-1.5 rounded-lg bg-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-300 transition-all">
                          Verify Now
                        </button>
                      </div>
                    )}
                    {d.verified && (
                      <p className="text-xs text-slate-500 mt-1">Client portals use: <code className="text-[#1A9EF2] bg-[#C3E8FF]/20 px-1 rounded">https://{d.domain}/project/...</code></p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
