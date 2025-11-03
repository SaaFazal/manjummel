// api/bookings.js
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// CORS helper
function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end(); // preflight

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, trip } = req.body || {};
    if (!name || !email || !phone || !trip) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'Supabase env vars not set' });
    }
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY not set' });
    }

    // 1) Store in Supabase
    const { data, error } = await supabase
      .from('bookings')
      .insert({ name, email, phone, trip })
      .select()
      .single();

    if (error) throw error;

    // 2) Send emails (use Resend’s neutral sender until your domain is verified)
    const sender =
      process.env.MAIL_FROM ||
      'Manjummel Travels <notifications@resend.dev>'; // swap to bookings@manjummeltravels.co.uk after DNS verified in Resend

    // to customer
    await resend.emails.send({
      from: sender,
      to: email,
      subject: `We received your enquiry – ${trip}`,
      html: `<p>Hi ${escapeHtml(name)},</p>
             <p>Thanks for your enquiry for <strong>${escapeHtml(trip)}</strong>.</p>
             <p>We’ll get back to you shortly with details.</p>
             <p>— Manjummel Travels</p>`
    });

    // to admin (optional)
    if (process.env.ADMIN_EMAIL) {
      await resend.emails.send({
        from: sender,
        to: process.env.ADMIN_EMAIL,
        subject: `New booking enquiry: ${trip}`,
        html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p>
               <p><strong>Email:</strong> ${escapeHtml(email)}</p>
               <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
               <p><strong>Trip:</strong> ${escapeHtml(trip)}</p>`
      });
    }

    return res.status(201).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('bookings error:', err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}