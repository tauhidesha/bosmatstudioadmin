import crypto from 'crypto';

/**
 * Hash user data (email, phone, etc.) as required by Meta CAPI.
 * Data must be lowercase and hashed with SHA-256.
 */
const hashData = (data?: string | null) => {
  if (!data) return undefined;
  
  // Basic normalization: trim, remove non-alphanumeric for phone numbers if needed
  let normalized = data.trim().toLowerCase();
  
  // If it's a phone number, keep only digits (and maybe +)
  if (/^[+0-9\s-]+$/.test(normalized)) {
    normalized = normalized.replace(/[^\d]/g, '');
  }

  if (!normalized) return undefined;
  
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

export interface CapiEventData {
  eventName: string;
  eventId?: string;
  eventTime?: number;
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
  };
  customData?: {
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    [key: string]: any;
  };
}

export const sendCapiEvent = async (eventData: CapiEventData) => {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  const testEventCode = process.env.META_CAPI_TEST_CODE;

  if (!pixelId || !token) {
    console.warn('[Meta CAPI] Skipping event tracking, missing PIXEL_ID or CAPI_TOKEN.');
    return;
  }

  const {
    eventName,
    eventId,
    eventTime = Math.floor(Date.now() / 1000),
    userData,
    customData,
  } = eventData;

  const payload: any = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: 'system_generated',
        user_data: {
          em: hashData(userData.email) ? [hashData(userData.email)] : undefined,
          ph: hashData(userData.phone) ? [hashData(userData.phone)] : undefined,
          fn: hashData(userData.firstName) ? [hashData(userData.firstName)] : undefined,
          ln: hashData(userData.lastName) ? [hashData(userData.lastName)] : undefined,
        },
        custom_data: customData,
      }
    ],
  };

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();
    
    if (!res.ok) {
      console.error('[Meta CAPI] Error tracking event:', responseData);
    } else {
      console.log(`[Meta CAPI] Successfully tracked event: ${eventName}`, responseData);
    }
  } catch (error) {
    console.error('[Meta CAPI] Fetch error:', error);
  }
};
