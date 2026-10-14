"use client";

import { startTransition, useActionState, useEffect, useRef, useTransition } from "react";
import { changeOwnPassword, createUser, resetPassword, setUserActive, setUserRole } from "@/app/actions/users";
import type { FormState } from "@/app/actions/employees";

function useForm(fn: (p: FormState, f: FormData) => Promise<FormState>) {
  const [state, action, pending] = useActionState(fn, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return {
    state, pending, ref,
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); },
  };
}

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <span className="text-sm text-red-700">{state.error}</span>;
  if (state?.ok) return <span className="text-sm text-emerald-700">{state.ok}</span>;
  return null;
}

export function CreateUserForm() {
  const { state, pending, ref, onSubmit } = useForm(createUser);
  return (
    <form ref={ref} onSubmit={onSubmit} className="card space-y-3 p-5">
      <h2 className="font-semibold text-navy">Create user</h2>
      <div><label className="label" htmlFor="nu-name">Full name</label><input id="nu-name" name="full_name" className="input" required /></div>
      <div><label className="label" htmlFor="nu-user">Username</label><input id="nu-user" name="username" className="input" required autoComplete="off" /></div>
      <div><label className="label" htmlFor="nu-role">Role</label>
        <select id="nu-role" name="role" className="input" defaultValue="hr">
          <option value="admin">Administrator — full access incl. users & deletion</option>
          <option value="hr">HR Officer — add / edit employees and documents</option>
          <option value="viewer">Viewer — read-only</option>
        </select></div>
      <div><label className="label" htmlFor="nu-pw">Initial password</label><input id="nu-pw" name="password" type="password" minLength={8} className="input" required autoComplete="new-password" /></div>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create user"}</button><Msg state={state} /></div>
    </form>
  );
}

export function UserRowControls({ id, role, active, self }: { id: number; role: string; active: boolean; self: boolean }) {
  const [pending, start] = useTransition();
  const { state: pwState, pending: pwPending, ref: pwRef, onSubmit: pwSubmit } = useForm(resetPassword);
  if (self) return <span className="text-xs text-muted">This is you</span>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select defaultValue={role} disabled={pending} className="input w-auto py-1 text-xs" onChange={(e) => { const v = e.target.value; start(() => setUserRole(id, v)); }}>
        <option value="admin">Admin</option><option value="hr">HR Officer</option><option value="viewer">Viewer</option>
      </select>
      <button className="btn-secondary btn-sm" disabled={pending} onClick={() => start(() => setUserActive(id, !active))}>{active ? "Deactivate" : "Activate"}</button>
      <form ref={pwRef} onSubmit={pwSubmit} className="flex items-center gap-1">
        <input type="hidden" name="id" value={id} />
        <input name="password" type="password" minLength={8} placeholder="New password" className="input w-32 py-1 text-xs" required autoComplete="new-password" />
        <button className="btn-secondary btn-sm" disabled={pwPending}>Reset</button>
      </form>
      <Msg state={pwState} />
    </div>
  );
}

export function ChangePasswordForm() {
  const { state, pending, ref, onSubmit } = useForm(changeOwnPassword);
  return (
    <form ref={ref} onSubmit={onSubmit} className="card space-y-3 p-5">
      <h2 className="font-semibold text-navy">Change my password</h2>
      <div><label className="label" htmlFor="cp-cur">Current password</label><input id="cp-cur" name="current" type="password" className="input" required autoComplete="current-password" /></div>
      <div><label className="label" htmlFor="cp-new">New password</label><input id="cp-new" name="password" type="password" minLength={8} className="input" required autoComplete="new-password" /></div>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending}>Update password</button><Msg state={state} /></div>
    </form>
  );
}
