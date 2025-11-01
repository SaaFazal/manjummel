import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, email, phone, trip } = req.body || {};
    if (!name || !email || !phone || !trip) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({ name, email, phone, trip })
      .select()
      .single();
    if (error) throw error;

    await resend.emails.send({
      from: 'Manjummel Travels <bookings@manjummeltravels.co.uk>',
      to: email,
      subject: `We received your enquiry – ${trip}`,
      html: `<p>Hi ${escapeHtml(name)},</p>
             <p>Thanks for your enquiry for <strong>${escapeHtml(trip)}</strong>.</p>
             <p>We’ll get back to you shortly with details.</p>
             <p>— Manjummel Travels</p>`
    });

    if (process.env.ADMIN_EMAIL) {
      await resend.emails.send({
        from: 'Manjummel Travels <bookings@manjummeltravels.co.uk>',
        to: process.env.ADMIN_EMAIL,
        subject: `New booking enquiry: ${trip}`,
        html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p>
               <p><strong>Email:</strong> ${escapeHtml(email)}</p>
               <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
               <p><strong>Trip:</strong> ${escapeHtml(trip)}</p>`
      });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
}

function escapeHtml(s=''){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

