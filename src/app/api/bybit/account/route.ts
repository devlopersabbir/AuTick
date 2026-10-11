import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

interface BybitWalletResponse {
  retCode: number;
  retMsg: string;
  result?: {
    list?: Array<{
      accountType?: string;
      totalWalletBalance?: string;
      totalEquity?: string;
    }>;
  };
}

interface AccountRequestBody {
  authType?: unknown;
  apiKey?: unknown;
  apiSecret?: unknown;
  signature?: unknown;
  timestamp?: unknown;
}

function jsonResponse(
  body: { success: false; error: string } | {
    success: true;
    account: {
      accountType: string;
      walletBalance: string;
      equity: string;
    };
  },
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return jsonResponse({ success: false, error: 'Cross-origin requests are not allowed.' }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Request body must be valid JSON.' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return jsonResponse({ success: false, error: 'Request body must include Bybit API credentials.' }, 400);
  }

  const { authType, apiKey, apiSecret, signature: suppliedSignature, timestamp: suppliedTimestamp } =
    body as AccountRequestBody;
  if (
    (authType !== 'system' && authType !== 'self') ||
    typeof apiKey !== 'string' ||
    !apiKey.trim() ||
    apiKey.length > 256
  ) {
    return jsonResponse({ success: false, error: 'Enter a valid Bybit API key and key type.' }, 400);
  }

  const key = apiKey.trim();
  const recvWindow = '5000';
  const queryString = 'accountType=UNIFIED';
  let timestamp: string;
  let signature: string;

  if (authType === 'system') {
    if (typeof apiSecret !== 'string' || !apiSecret.trim() || apiSecret.length > 256) {
      return jsonResponse({ success: false, error: 'Enter the API secret for this system-generated key.' }, 400);
    }

    timestamp = Date.now().toString();
    const signaturePayload = `${timestamp}${key}${recvWindow}${queryString}`;
    signature = createHmac('sha256', apiSecret.trim()).update(signaturePayload).digest('hex');
  } else {
    if (
      typeof suppliedTimestamp !== 'string' ||
      !/^\d{13}$/.test(suppliedTimestamp) ||
      typeof suppliedSignature !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(suppliedSignature) ||
      suppliedSignature.length > 1024
    ) {
      return jsonResponse({ success: false, error: 'Invalid RSA signature. Check the private key format and try again.' }, 400);
    }

    timestamp = suppliedTimestamp;
    signature = suppliedSignature;
  }

  let response: Response;
  try {
    response = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${queryString}`, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': key,
        'X-BAPI-SIGN': signature,
        'X-BAPI-SIGN-TYPE': '2',
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return jsonResponse({
      success: false,
      error: 'Could not reach Bybit. Check your connection and Bybit API availability for your region.',
    }, 502);
  }

  if (!response.ok) {
    return jsonResponse({ success: false, error: `Bybit returned HTTP ${response.status}.` }, 502);
  }

  let result: BybitWalletResponse;
  try {
    result = await response.json();
  } catch {
    return jsonResponse({ success: false, error: 'Bybit returned an unreadable response.' }, 502);
  }

  if (result.retCode !== 0) {
    if ([10003, 10004].includes(result.retCode)) {
      return jsonResponse({ success: false, error: 'Bybit rejected the API key or signature. Check the key and secret.' }, 401);
    }
    if (result.retCode === 10005) {
      return jsonResponse({ success: false, error: 'This API key needs read-only account permissions for wallet data.' }, 403);
    }
    return jsonResponse({
      success: false,
      error: `Bybit account check failed (${result.retCode}): ${result.retMsg}`,
    }, 502);
  }

  const account = result.result?.list?.[0];
  if (!account?.totalWalletBalance || !account.totalEquity) {
    return jsonResponse({
      success: false,
      error: 'Bybit did not return Unified account balances for this API key.',
    }, 502);
  }

  return jsonResponse({
    success: true,
    account: {
      accountType: account.accountType || 'UNIFIED',
      walletBalance: account.totalWalletBalance,
      equity: account.totalEquity,
    },
  });
}
