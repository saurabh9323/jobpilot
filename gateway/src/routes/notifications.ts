import { Router } from "express";
import sgMail from "@sendgrid/mail";
import axios from "axios";

export const notifRouter = Router();

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// POST /api/notifications/slack
notifRouter.post("/slack", async (req, res) => {
  const { message, blocks } = req.body;
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;

  if (!token || !channel) {
    return res.status(503).json({ error: "Slack not configured" });
  }

  try {
    await axios.post(
      "https://slack.com/api/chat.postMessage",
      { channel, text: message, blocks },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: "Slack send failed" });
  }
});

// POST /api/notifications/telegram
notifRouter.post("/telegram", async (req, res) => {
  const { message } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(503).json({ error: "Telegram not configured" });
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text: message, parse_mode: "Markdown" },
    );
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: "Telegram send failed" });
  }
});

// POST /api/notifications/email
notifRouter.post("/email", async (req, res) => {
  const { to, subject, html } = req.body;

  if (!process.env.SENDGRID_API_KEY) {
    return res.status(503).json({ error: "Email not configured" });
  }

  try {
    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM ?? "noreply@jobpilot.ai",
      subject,
      html,
    });
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: "Email send failed" });
  }
});

// POST /api/notifications/job-alert  — formatted offer/interview alert
notifRouter.post("/job-alert", async (req, res) => {
  const { type, job_title, company, score } = req.body;

  const emoji: Record<string, string> = {
    offer: "🎉",
    interview: "📅",
    high_match: "⚡",
    applied: "✅",
  };

  const message =
    `${emoji[type] ?? "📌"} *JobPilot Alert*\n` +
    `Type: ${type}\n` +
    `Role: ${job_title} @ ${company}\n` +
    (score ? `Match: ${Math.round(score * 100)}%\n` : "");

  // Fire and forget — send to all configured channels
  const channels = [];
  if (process.env.TELEGRAM_BOT_TOKEN) {
    channels.push(
      axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }).catch(() => {}),
    );
  }

  await Promise.allSettled(channels);
  res.json({ dispatched: channels.length });
});
