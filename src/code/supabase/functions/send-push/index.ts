import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  message: string;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: NotificationRecord;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

Deno.serve(async request => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('PUSH_VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('PUSH_VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('PUSH_VAPID_SUBJECT');

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('Push delivery secrets are not fully configured.');
    return jsonResponse({ error: 'Push delivery is not configured.' }, 500);
  }

  if (request.headers.get('x-push-webhook-secret') !== webhookSecret) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json() as WebhookPayload;
  } catch (error) {
    console.error('Invalid database webhook payload:', error);
    return jsonResponse({ error: 'Invalid webhook payload.' }, 400);
  }

  const notification = payload.record;
  if (
    payload.type !== 'INSERT' ||
    payload.table !== 'notifications' ||
    !notification?.id ||
    !notification.user_id ||
    !notification.title ||
    !notification.message
  ) {
    return jsonResponse({ error: 'Expected a notification insert record.' }, 400);
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const { data: subscriptions, error } = await client
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', notification.user_id);

  if (error) {
    console.error('Could not load push subscriptions:', error);
    return jsonResponse({ error: 'Could not load push subscriptions.' }, 500);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const results = await Promise.allSettled(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      }, JSON.stringify({
        title: notification.title,
        body: notification.message,
        url: '/'
      }));
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? error.statusCode
        : undefined;

      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await client
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
        if (deleteError) console.error('Could not remove expired push subscription:', deleteError);
        return;
      }

      throw error;
    }
  }));

  const failedDeliveries = results.filter(result => result.status === 'rejected');
  for (const result of failedDeliveries) {
    if (result.status === 'rejected') console.error('Push delivery failed:', result.reason);
  }

  if (failedDeliveries.length > 0) {
    return jsonResponse({
      sent: subscriptions.length - failedDeliveries.length,
      failed: failedDeliveries.length
    }, 502);
  }

  return jsonResponse({ sent: subscriptions.length, failed: 0 });
});
