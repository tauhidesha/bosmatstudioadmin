import crypto from 'crypto';

/**
 * Hash user data (email, phone, etc.) as required by Meta CAPI.
 * Data must be lowercase and hashed with SHA-256.
 */
const hashData = (data?: string | null, isPhone: boolean = false) => {
  if (!data) return undefined;
  
  let normalized = data.trim().toLowerCase();
  
  if (isPhone) {
    // Aggressively strip everything except digits (e.g. remove @lid, @c.us, spaces, plus signs)
    normalized = normalized.replace(/\D/g, '');
    // Meta requires stripping leading zeros and including country code
    normalized = normalized.replace(/^0+/, '');
    // If it's an Indonesian number (starts with 8) and missing country code, prepend 62
    if (normalized.startsWith('8') && normalized.length >= 9) {
      normalized = '62' + normalized;
    }
  }

  if (!normalized) return undefined;
  
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

/**
 * Strip WhatsApp suffixes (@lid, @c.us) from lead_id.
 * Meta expects a plain numeric lead ID without any suffix.
 */
const cleanLeadId = (leadId?: string | null): string | undefined => {
  if (!leadId) return undefined;
  // Remove @lid, @c.us, or any @xxx suffix
  const cleaned = leadId.replace(/@\S+$/, '').trim();
  return cleaned || undefined;
};

export interface CapiEventData {
  eventName: string;
  eventId?: string;
  eventTime?: number;
  actionSource?: string;     // e.g. 'business_messaging', 'system_generated', 'website'
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    leadId?: string;          // whatsappLid — will be stripped of @lid suffix automatically
    pageId?: string;          // Facebook Page ID required for business_messaging
    ctwaClid?: string;        // Click-To-WhatsApp Click ID (required for business_messaging)
    clientIpAddress?: string;
    clientUserAgent?: string;
  };
  customData?: {
    value?: number;
    currency?: string;
    order_id?: string;
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    [key: string]: any;
  };
}

export const sendCapiEvent = async (eventData: CapiEventData) => {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  const testEventCode = process.env.META_CAPI_TEST_CODE; // e.g. TEST85453

  if (!pixelId || !token) {
    console.warn('[Meta CAPI] Skipping event tracking, missing PIXEL_ID or CAPI_TOKEN.');
    return;
  }

  const {
    eventName,
    eventId,
    eventTime = Math.floor(Date.now() / 1000),
    actionSource: customActionSource,
    userData,
    customData,
  } = eventData;

  const cleanedLeadId = cleanLeadId(userData.leadId);
  const pageId = userData.pageId || process.env.META_PAGE_ID || process.env.NEXT_PUBLIC_META_PAGE_ID || '1491064727874575';
  const ctwaClid = userData.ctwaClid;

  // Meta business_messaging action_source strictly requires page_id AND ctwa_clid in user_data for allowed events (Purchase, LeadSubmitted, etc.)
  // If ctwa_clid is missing (e.g. organic/manual transactions without CTWA ad click ID), fallback to 'system_generated' to prevent error 2804071.
  const validBusinessMessagingEvents = ['Purchase', 'LeadSubmitted', 'Lead', 'Contact'];
  const canUseBusinessMessaging = validBusinessMessagingEvents.includes(eventName) && !!pageId && !!ctwaClid;

  const actionSource = customActionSource || (
    canUseBusinessMessaging ? 'business_messaging' : 'system_generated'
  );

  const payload: any = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: actionSource,
        ...(actionSource === 'business_messaging' ? { messaging_channel: 'whatsapp' } : {}),
        user_data: {
          em: hashData(userData.email) ? [hashData(userData.email)!] : undefined,
          ph: hashData(userData.phone, true) ? [hashData(userData.phone, true)!] : undefined,
          fn: hashData(userData.firstName) ? [hashData(userData.firstName)!] : undefined,
          ln: hashData(userData.lastName) ? [hashData(userData.lastName)!] : undefined,
          ...(pageId && actionSource === 'business_messaging' ? { page_id: pageId } : {}),
          ...(ctwaClid ? { ctwa_clid: ctwaClid } : {}),
          // lead_id must NOT be hashed — sent plain per Meta docs
          ...(cleanedLeadId ? { lead_id: cleanedLeadId } : {}),
        },
        custom_data: customData,
      }
    ],
    // Test event code — remove from payload before going to production
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

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
