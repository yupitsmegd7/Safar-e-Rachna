'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {ArrowLeft, ArrowUpRight, Feather} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {isConfigured} from '@/lib/supabase/config';
import {safeReturnPath} from '@/lib/request';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [next, setNext] = useState('/');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setNext(safeReturnPath(params.get('next')));
    if (params.has('error')) setError('Sign-in could not be completed. Please try again.');
    const theme = localStorage.getItem('rachna-theme');
    if (theme) document.documentElement.dataset.theme = theme;
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true); setError('');
    try {
      const {error} = await createClient().auth.signInWithOtp({email: email.trim(), options: {shouldCreateUser: true}});
      if (error) throw error;
      setSent(true); setCooldown(60); setCode('');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sent) return sendCode();
    setBusy(true); setError('');
    try {
      const {error} = await createClient().auth.verifyOtp({email: email.trim(), token: code.trim(), type: 'email'});
      if (error) throw error;
      location.assign(next);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  async function google() {
    setBusy(true); setError('');
    try {
      const redirectTo = new URL('/auth/callback', location.origin);
      redirectTo.searchParams.set('next', next);
      const {error} = await createClient().auth.signInWithOAuth({provider: 'google', options: {redirectTo: redirectTo.href}});
      if (error) throw error;
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <div className="site-shell auth-shell">
    <div className="utility"><a href="/">SAFAR-E-RACHNA</a><span>A PLACE FOR YOUR WORDS</span></div>
    <main className="auth-page">
      <a className="back-link" href={next}><ArrowLeft size={16}/> Back to the journal</a>
      <div className="auth-heading"><Feather size={28}/><span className="eyebrow">THE CONVERSATION CONTINUES</span><h1>Come, take a seat.</h1><p>Sign in to appreciate a piece or leave a thought. The author can also edit and publish.</p></div>
      {!isConfigured() ? <p role="alert">Sign-in is not configured yet. Complete the Supabase setup in DEPLOYMENT.md.</p> : <>
        <form onSubmit={submit} className="auth-form">
          <label className="field">Your email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} readOnly={sent} placeholder="you@example.com"/></label>
          {sent && <><p className="auth-help" role="status">Enter the code sent to <strong>{email}</strong>. Check your spam folder too.</p><label className="field">Email code<input type="text" inputMode="numeric" pattern="[0-9]{6,10}" autoComplete="one-time-code" required minLength={6} maxLength={10} autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="Your sign-in code"/></label></>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'One moment…' : sent ? 'Sign in' : 'Email me a code'}<ArrowUpRight size={16}/></button>
        </form>
        {sent && <div className="auth-options"><button type="button" onClick={sendCode} disabled={busy || cooldown > 0}>{cooldown ? `Resend in ${cooldown}s` : 'Send another code'}</button><button type="button" disabled={busy} onClick={() => {setSent(false); setCode(''); setError('');}}>Use another email</button></div>}
        {process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true' && <button className="btn auth-google" disabled={busy} onClick={google}>Continue with Google</button>}
        <p className="auth-help auth-footnote">No password to remember. Your email stays private; the name you enter with a comment is public.</p>
      </>}
    </main>
  </div>;
}
