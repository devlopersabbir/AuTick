'use client';

import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarRange, Check, LoaderCircle, X } from 'lucide-react';

interface BrokerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHistoricalRange: () => void;
}

interface BybitAccount {
  accountType: string;
  walletBalance: string;
  equity: string;
}

type BybitKeyType = 'system' | 'self';

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function encodeDerLength(length: number): Uint8Array {
  if (length < 128) return new Uint8Array([length]);

  const bytes: number[] = [];
  for (let remaining = length; remaining > 0; remaining = Math.floor(remaining / 256)) {
    bytes.unshift(remaining & 0xff);
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function decodeRsaPrivateKey(pem: string): Uint8Array {
  const isPkcs1 = pem.includes('-----BEGIN RSA PRIVATE KEY-----');
  const isPkcs8 = pem.includes('-----BEGIN PRIVATE KEY-----');
  if (!isPkcs1 && !isPkcs8) {
    throw new Error('Enter an RSA private key in PEM format (PKCS#1 or PKCS#8).');
  }

  const encoded = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
  let der: Uint8Array;
  try {
    der = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    throw new Error('The RSA private key is not valid PEM/base64.');
  }

  if (!isPkcs1) return der;

  const rsaAlgorithm = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);
  const privateKeyOctetString = concatBytes(new Uint8Array([0x04]), encodeDerLength(der.length), der);
  const pkcs8Body = concatBytes(new Uint8Array([0x02, 0x01, 0x00]), rsaAlgorithm, privateKeyOctetString);
  return concatBytes(new Uint8Array([0x30]), encodeDerLength(pkcs8Body.length), pkcs8Body);
}

async function signBybitRequest(apiKey: string, privateKeyPem: string) {
  const timestamp = Date.now().toString();
  const payload = `${timestamp}${apiKey}5000accountType=UNIFIED`;
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    decodeRsaPrivateKey(privateKeyPem).buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(payload)
  );
  const signature = btoa(
    Array.from(new Uint8Array(signatureBytes), (byte) => String.fromCharCode(byte)).join('')
  );

  return { timestamp, signature };
}

export const BrokerSelectorModal: React.FC<BrokerSelectorModalProps> = ({
  isOpen,
  onClose,
  onOpenHistoricalRange,
}) => {
  const [account, setAccount] = useState<BybitAccount | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyType, setKeyType] = useState<BybitKeyType>('system');
  const formRef = useRef<HTMLFormElement>(null);
  const activeAttemptRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  const clearConnection = useCallback(() => {
    activeAttemptRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    formRef.current?.reset();
    setAccount(null);
    setError('');
    setIsSubmitting(false);
    setKeyType('system');
  }, []);

  const handleClose = useCallback(() => {
    clearConnection();
    onClose();
  }, [clearConnection, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const handleConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const attempt = ++activeAttemptRef.current;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const apiKey = formData.get('apiKey');
    let signingInBrowser = false;

    try {
      if (typeof apiKey !== 'string' || !apiKey.trim()) {
        setError('Enter your Bybit API key.');
        return;
      }

      const credentials: Record<string, string> = {
        authType: keyType,
        apiKey: apiKey.trim(),
      };

      if (keyType === 'system') {
        const apiSecret = formData.get('apiSecret');
        if (typeof apiSecret !== 'string' || !apiSecret.trim()) {
          setError('Enter your Bybit API secret.');
          return;
        }
        credentials.apiSecret = apiSecret;
      } else {
        const privateKey = formData.get('privateKey');
        if (typeof privateKey !== 'string' || !privateKey.trim()) {
          setError('Enter your RSA private key.');
          return;
        }
        signingInBrowser = true;
        const signedRequest = await signBybitRequest(apiKey.trim(), privateKey);
        signingInBrowser = false;
        if (activeAttemptRef.current !== attempt) return;
        credentials.timestamp = signedRequest.timestamp;
        credentials.signature = signedRequest.signature;
      }

      const controller = new AbortController();
      requestControllerRef.current = controller;
      const response = await fetch('/api/bybit/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        signal: controller.signal,
      });
      if (activeAttemptRef.current !== attempt) return;
      const result: {
        success: boolean;
        account?: BybitAccount;
        error?: string;
      } = await response.json();

      if (!response.ok || !result.success || !result.account) {
        setError(result.error || 'Unable to verify this Bybit account.');
        return;
      }

      form.reset();
      setAccount(result.account);
    } catch (caught) {
      if (activeAttemptRef.current === attempt && !(caught instanceof Error && caught.name === 'AbortError')) {
        setError(
          signingInBrowser && caught instanceof Error
            ? caught.message
            : 'Unable to reach AuTick or Bybit. Check your connection and try again.'
        );
      }
    } finally {
      if (activeAttemptRef.current === attempt) {
        requestControllerRef.current = null;
        setIsSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-selector-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-[#273044] bg-[#0d111a] text-neutral-100 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[#20283a] px-5 py-4">
          <div>
            <h2 id="broker-selector-title" className="text-base font-bold text-white">
              Connect a broker
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              Choose a broker for market data and account details.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close broker selector"
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-300">Broker</h3>
            <span className="text-[10px] text-neutral-500">1 listed</span>
          </div>

          <article className="rounded-lg border border-[#343044] bg-[#131722] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#f7a600]/10 text-[11px] font-black text-[#f7a600]">
                BYBIT
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Bybit</h4>
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                    Read-only
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                  Verify your Bybit Unified account and view its current wallet balance and equity.
                </p>
              </div>
            </div>

            {account ? (
              <div className="mt-4 border-t border-[#262d3c] pt-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>Bybit account verified for this session</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md bg-[#0d111a] p-3">
                    <dt className="text-[10px] text-neutral-500">Wallet balance (USD)</dt>
                    <dd className="mt-1 font-mono font-semibold text-white">
                      {Number(account.walletBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                  <div className="rounded-md bg-[#0d111a] p-3">
                    <dt className="text-[10px] text-neutral-500">Equity (USD)</dt>
                    <dd className="mt-1 font-mono font-semibold text-white">
                      {Number(account.equity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => setAccount(null)}
                  className="mt-3 text-[11px] text-neutral-400 underline decoration-neutral-600 underline-offset-2 hover:text-white"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleConnect} className="mt-4 space-y-3 border-t border-[#262d3c] pt-3">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'system', title: 'System-generated', detail: 'HMAC key + secret' },
                    { id: 'self', title: 'Self-generated', detail: 'RSA private key' },
                  ] as const).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setKeyType(option.id);
                        setError('');
                      }}
                      aria-pressed={keyType === option.id}
                      className={`rounded-md border p-2 text-left transition-colors ${
                        keyType === option.id
                          ? 'border-amber-500/60 bg-amber-500/10 text-white'
                          : 'border-[#30394b] bg-[#0d111a] text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-[10px] font-semibold">{option.title}</span>
                      <span className="mt-0.5 block text-[9px] text-neutral-500">{option.detail}</span>
                    </button>
                  ))}
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-medium text-neutral-300">API key</span>
                  <input
                    name="apiKey"
                    type="password"
                    autoComplete="off"
                    required
                    maxLength={256}
                    className="w-full rounded-md border border-[#30394b] bg-[#0d111a] px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                    placeholder="Enter your Bybit API key"
                  />
                </label>
                {keyType === 'system' ? (
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-medium text-neutral-300">API secret</span>
                    <input
                      name="apiSecret"
                      type="password"
                      autoComplete="new-password"
                      required
                      maxLength={256}
                      className="w-full rounded-md border border-[#30394b] bg-[#0d111a] px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                      placeholder="Enter your Bybit API secret"
                    />
                  </label>
                ) : (
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-medium text-neutral-300">RSA private key (PEM)</span>
                    <textarea
                      name="privateKey"
                      autoComplete="off"
                      required
                      rows={4}
                      className="w-full resize-y rounded-md border border-[#30394b] bg-[#0d111a] px-3 py-2 font-mono text-[10px] text-white outline-none focus:border-amber-500"
                      placeholder="-----BEGIN PRIVATE KEY-----"
                    />
                    <span className="block text-[10px] text-neutral-500">
                      The private key is used in this browser to sign the request and is never sent to AuTick.
                    </span>
                  </label>
                )}
                <p className="text-[10px] leading-relaxed text-neutral-500">
                  Create a read-only API key with account read permissions only. Never enable trading or withdrawals.
                  {keyType === 'system'
                    ? ' The API secret is sent to the server for this check and is not saved.'
                    : ' The RSA private key stays in this browser and is not sent to the server.'}
                </p>
                {error && (
                  <p role="alert" className="text-[11px] leading-relaxed text-red-400">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      Verifying account...
                    </>
                  ) : (
                    'Verify & connect'
                  )}
                </button>
              </form>
            )}
          </article>

          <p className="mt-3 text-[11px] text-neutral-500">
            This checks your Bybit Unified account only. The result is not stored and clears when you close this dialog or reload AuTick.
          </p>
        </div>

        <footer className="flex items-center justify-between border-t border-[#20283a] bg-[#0a0d14] px-5 py-3">
          <button
            type="button"
            onClick={() => {
              clearConnection();
              onOpenHistoricalRange();
            }}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Historical Range
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Close
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </footer>
      </section>
    </div>
  );
};