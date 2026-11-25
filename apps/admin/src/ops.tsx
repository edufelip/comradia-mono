import { useEffect, useRef, useState } from 'react';
import { EDITABLE_SECTIONS, editedSection, earningPreview, hasUnsavedChanges, type Draft } from './editor';
import type { AdminClient } from './firebase';

type Summary = { id: string; version: number; status: string };
type List = { ruleSets: Summary[]; active: { ruleSetId: string } | null };
type RuleSet = { ruleSet: Draft };
type Comparison = {
  source: string;
  truncated: boolean;
  active: { events: number; cravos: number; awards: number };
  draft: { events: number; cravos: number; awards: number };
};

const sections = ['Rule sets', 'Simulator', 'Ledger', 'Flags', 'Liability', 'Audit'] as const;
type Section = (typeof sections)[number];
type EditableSection = (typeof EDITABLE_SECTIONS)[number][0];

export function OpsConsole({ client }: { client: AdminClient }) {
  const [tab, setTab] = useState<Section>('Rule sets');
  const [list, setList] = useState<List>({ ruleSets: [], active: null });
  const [id, setId] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [section, setSection] = useState<EditableSection>('earnRules');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [member, setMember] = useState('');
  const [amount, setAmount] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [output, setOutput] = useState<unknown>(undefined);
  const [busy, setBusy] = useState(false);
  const locking = useRef(false);
  const adjustmentRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const editable = draft?.status === 'draft' || draft?.status === 'simulated';

  const report = (error: unknown) => setError(error instanceof Error ? error.message : 'Operation failed.');
  function run(work: () => Promise<void>) {
    if (locking.current) return;
    locking.current = true;
    setBusy(true);
    setError('');
    void work().catch(report).finally(() => {
      locking.current = false;
      setBusy(false);
    });
  }
  useEffect(() => {
    let active = true;
    void client.call<List>('gamListRuleSets').then(
      (value) => { if (active) setList(value); },
      (error: unknown) => { if (active) report(error); },
    );
    return () => { active = false; };
  }, [client]);

  async function refresh() {
    setList(await client.call<List>('gamListRuleSets'));
  }

  async function open(ruleSetId: string) {
    if (ruleSetId === '') { setId(''); setDraft(null); setSaved(null); setText(''); return; }
    const { ruleSet } = await client.call<RuleSet>('gamGetRuleSet', { ruleSetId });
    setId(ruleSetId);
    setDraft(ruleSet);
    setSaved(ruleSet);
    setText(JSON.stringify(ruleSet[section], null, 2));
  }

  function changeSection(key: EditableSection) {
    if (draft === null) return;
    try {
      const changed = editable ? editedSection(draft, section, text) : draft;
      setDraft(changed);
      setSection(key);
      setText(JSON.stringify(changed[key], null, 2));
      setError('');
    } catch (error) {
      report(error);
    }
  }

  let preview: Draft | null = draft;
  let formError = '';
  if (editable && draft !== null) {
    try { preview = editedSection(draft, section, text); }
    catch (error) { formError = error instanceof Error ? error.message : 'Invalid section.'; preview = null; }
  }
  const dirty = editable && saved !== null && hasUnsavedChanges(saved, preview);

  async function invoke(name: string, input: Draft = {}) {
    setOutput(await client.call<unknown>(name, input));
  }
  function lifecycle(name: string) {
    run(async () => {
      await invoke(name, { ruleSetId: id, reason });
      await refresh();
      await open(id);
    });
  }

  return (
    <>
      <nav aria-label="Cravos administration">
        {sections.map((name) => <button key={name} aria-pressed={tab === name} onClick={() => {
          setTab(name); setOutput(undefined); setError('');
        }}>{name}</button>)}
      </nav>
      <section aria-labelledby="current-section">
        <h2 id="current-section">{tab}</h2>
        {error && <p role="alert">{error}</p>}
        {tab === 'Rule sets' && <>
          <div className="inline">
            <label>Rule set<select value={id} disabled={busy} onChange={(event) => {
              const next = event.target.value; run(() => open(next));
            }}>
              <option value="">Choose a version</option>
              {list.ruleSets.map((version) => <option key={version.id} value={version.id}>
                v{version.version} · {version.status}{version.id === list.active?.ruleSetId ? ' · active' : ''}
              </option>)}
            </select></label>
            <button disabled={busy} onClick={() => run(refresh)}>Refresh versions</button>
            <button disabled={busy} onClick={() => run(async () => {
              const next = await client.call<{ id: string }>('gamCreateDraft', id ? { fromRuleSetId: id } : {});
              await refresh();
              await open(next.id);
            })}>Create draft</button>
          </div>
          {draft && <>
            <div className="inline">
              {EDITABLE_SECTIONS.map(([key, label]) => <button key={key} aria-pressed={key === section}
                onClick={() => changeSection(key)}>{label}</button>)}
            </div>
            <label>{EDITABLE_SECTIONS.find(([key]) => key === section)?.[1]} JSON
              <textarea rows={14} value={text} readOnly={!editable} onChange={(event) => setText(event.target.value)} />
            </label>
            {formError && <p role="alert">{formError}</p>}
            {preview && <div className="table-wrap"><table>
              <caption>Earn-rule preview</caption>
              <thead><tr><th>Event</th><th>Cravos</th><th>Daily maximum</th></tr></thead>
              <tbody>{earningPreview(preview).map((rule) => <tr key={rule.id}>
                <td>{rule.event}</td><td>{rule.amount}</td><td>{rule.dailyMaximum ?? '—'}</td>
              </tr>)}</tbody>
            </table></div>}
            {editable && <button disabled={!preview || busy} onClick={() => run(async () => {
              await invoke('gamUpdateDraft', { ruleSetId: id, ruleSet: preview, ...(reason.trim() ? { reason } : {}) });
              await open(id);
            })}>Save draft</button>}
            <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="inline">
              {editable ? <>
                <button disabled={busy || dirty || reason.trim().length < 10} onClick={() => lifecycle('gamRequestPublish')}>Request publish</button>
                <button disabled={busy || dirty || reason.trim().length < 10} onClick={() => lifecycle('gamApprovePublish')}>Approve publish</button>
              </> : <>
                <button disabled={busy || reason.trim().length < 10} onClick={() => lifecycle('gamRequestRollback')}>Request rollback</button>
                <button disabled={busy || reason.trim().length < 10} onClick={() => lifecycle('gamApproveRollback')}>Approve rollback</button>
              </>}
            </div>
            {dirty && <p>Save your edits before requesting or approving publication.</p>}
          </>}
        </>}
        {tab === 'Simulator' && <>
          <p>{draft ? `Selected version: v${String(draft.version)}` : 'Open a draft in Rule sets.'}</p>
          <button disabled={!preview || busy} onClick={() => run(async () => {
            const result = await client.call<Comparison>('gamSimulate', { ruleSet: preview });
            setComparison(result);
            setOutput(result);
          })}>Replay the last 14 days</button>
          {comparison && <table>
            <caption>{comparison.active.events} events replayed{comparison.truncated ? ' (sample limit reached)' : ''}</caption>
            <thead><tr><th>Version</th><th>Awards</th><th>Cravos</th></tr></thead>
            <tbody>
              <tr><th>Active</th><td>{comparison.active.awards}</td><td>{comparison.active.cravos}</td></tr>
              <tr><th>Draft</th><td>{comparison.draft.awards}</td><td>{comparison.draft.cravos}</td></tr>
            </tbody>
          </table>}
        </>}
        {tab === 'Ledger' && <>
          <label>Member UID<input value={member} onChange={(event) => setMember(event.target.value)} /></label>
          <button disabled={!member.trim() || busy} onClick={() => run(() => invoke('gamLedgerLookup', { uid: member.trim() }))}>Look up ledger</button>
          <label>Signed amount<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Adjustment reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <button disabled={busy || !member.trim() || !Number.isSafeInteger(Number(amount)) || Number(amount) === 0 || reason.trim().length < 10}
            onClick={() => run(async () => {
              const args = { uid: member.trim(), amount: Number(amount), reason };
              const fingerprint = JSON.stringify(args);
              if (adjustmentRequest.current?.fingerprint !== fingerprint) {
                adjustmentRequest.current = { fingerprint, key: crypto.randomUUID() };
              }
              await invoke('gamAdjustmentAppend', { ...args, idempotencyKey: adjustmentRequest.current.key });
              adjustmentRequest.current = null;
              setAmount('');
            })}>Request or apply adjustment</button>
          <label>Pending adjustment ID<input value={adjustment} onChange={(event) => setAdjustment(event.target.value)} /></label>
          <button disabled={busy || !adjustment.trim() || reason.trim().length < 10}
            onClick={() => run(() => invoke('gamAdjustmentApprove', { adjustmentId: adjustment.trim(), reason }))}>Approve adjustment</button>
        </>}
        {tab === 'Flags' && <button disabled={busy} onClick={() => run(() => invoke('gamGetFlags'))}>Read flags</button>}
        {tab === 'Liability' && <button disabled={busy} onClick={() => run(() => invoke('gamLiabilityReport'))}>Calculate liability</button>}
        {tab === 'Audit' && <button disabled={busy} onClick={() => run(() => invoke('gamAuditList', { limit: 50 }))}>Load audit history</button>}
        <div aria-live="polite">{busy ? <p>Working…</p> : output !== undefined && <pre>{JSON.stringify(output, null, 2)}</pre>}</div>
      </section>
    </>
  );
}
