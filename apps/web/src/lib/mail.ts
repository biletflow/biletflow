import nodemailer from "nodemailer";

function transport() {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  return nodemailer.createTransport({
    host,
    port,
    secure: false,
  });
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const from = process.env.EMAIL_FROM ?? "BiletFlow <no-reply@biletflow.local>";
  await transport().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? `<pre>${input.text}</pre>`,
  });
}
