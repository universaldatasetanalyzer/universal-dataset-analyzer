import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, RefreshCw, Crown, AlertCircle, Building2, Database } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { teamApi, datasetsApi, type TeamMember, type Dataset } from '../services/api';

interface MemberOf {
  orgId: string;
  orgName: string;
  plan: string;
  ownerName: string;
  ownerEmail: string;
  role: string;
}

export const TeamPage: React.FC = () => {
  const [members, setMembers]     = useState<TeamMember[]>([]);
  const [org, setOrg]             = useState<{ id: string; name: string; plan: string } | null>(null);
  const [memberOf, setMemberOf]   = useState<MemberOf[]>([]);
  const [sharedDs, setSharedDs]   = useState<Dataset[]>([]);
  const [loading, setLoading]     = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');

  const [inviting, setInviting]   = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  useEffect(() => {
    Promise.all([
      teamApi.get(),
      datasetsApi.list(),
    ]).then(([teamRes, dsRes]) => {
      const r = teamRes as unknown as {
        members?: TeamMember[];
        org?: { id: string; name: string; plan: string } | null;
        memberOf?: MemberOf[];
      };
      setMembers(r.members || []);
      setOrg(r.org || null);
      setMemberOf(r.memberOf || []);
      setSharedDs((dsRes as { sharedDatasets?: Dataset[] }).sharedDatasets || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true); setError(''); setSuccess('');
    try {
      const res = await teamApi.invite(inviteEmail, 'member') as unknown as { member: TeamMember };
      setMembers(prev => [...prev, res.member]);
      setInviteEmail('');
      setSuccess(`Invitation sent to ${inviteEmail}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invitation failed');
    } finally { setInviting(false); }
  }

  async function removeMember(id: string) {
    try {
      await teamApi.removeMember(id);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  const roleBadge = (role: string) => {
    if (role === 'owner')   return <Badge variant="purple"><Crown className="w-3 h-3 mr-1" />Owner</Badge>;
    if (role === 'admin')   return <Badge variant="blue">Admin</Badge>;
    if (role === 'analyst') return <Badge variant="green">Analyst</Badge>;
    return <Badge variant="gray">Viewer</Badge>;
  };

  const statusBadge = (status: string) => {
    if (status === 'active')  return <Badge variant="green">Active</Badge>;
    if (status === 'invited') return <Badge variant="yellow">Invited</Badge>;
    return <Badge variant="gray">{status}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Team</h1>
        {org && <p className="text-surface-500 text-sm mt-1">{org.name} · {org.plan} plan</p>}
      </div>

      {/* ── Workspaces I'm part of ───────────────────────────────────────── */}
      {memberOf.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-500" />
            Workspaces I'm Part Of
          </h2>
          <div className="space-y-3">
            {memberOf.map(o => (
              <div key={o.orgId} className="flex items-center gap-4 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {o.orgName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{o.orgName}</p>
                  <p className="text-xs text-surface-400 truncate">Owner: {o.ownerName} · {o.ownerEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  {roleBadge(o.role)}
                  <span className="text-xs text-surface-400 capitalize">{o.plan} plan</span>
                </div>
              </div>
            ))}
          </div>

          {/* Shared Datasets */}
          {sharedDs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Shared Datasets
              </p>
              <div className="space-y-2">
                {sharedDs.map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900">
                    <Database className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-xs text-surface-400">
                        Shared by <strong>{d.sharedByName}</strong> · {d.rows?.toLocaleString()} rows · {d.format?.toUpperCase()}
                      </p>
                    </div>
                    <Badge variant="blue">Shared</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Invite Member ────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-semibold text-sm mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invite Member</h2>
        {error   && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 text-sm mb-3"><AlertCircle className="w-4 h-4" />{error}</div>}
        {success && <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 text-sm mb-3">{success}</div>}
        <form onSubmit={invite} className="flex gap-3">
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com" required className="input flex-1 text-sm py-2" />
<input type="hidden" value="member" />
          <button type="submit" disabled={inviting} className="btn-primary text-sm px-4 py-2 disabled:opacity-50 flex items-center gap-2">
            {inviting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invite
          </button>
        </form>
      </Card>

      {/* ── Team Members ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-surface-100 dark:border-surface-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-surface-400" />
          <h2 className="font-semibold text-sm">Team Members ({members.length})</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-10 h-10 text-surface-300 mb-3" />
            <p className="text-surface-500 text-sm">No team members yet. Invite someone above.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {(m.name || m.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                  <p className="text-xs text-surface-400 truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {roleBadge(m.role)}
                  {statusBadge(m.status)}
                </div>
                {m.role !== 'owner' && (
                  <button onClick={() => removeMember(m.id)} className="text-surface-400 hover:text-red-500 transition-colors ml-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
};