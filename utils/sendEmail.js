const nodemailer = require('nodemailer');
require('dotenv').config();

const INSECURE_TLS = process.env.EMAIL_INSECURE_TLS === 'true';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,            // SSL
  secure: true,         // TLS 
  auth: {
    user: process.env.EMAIL_USER,   
    pass: process.env.EMAIL_PASS    
  },
  tls: {
    servername: 'smtp.gmail.com',
    //debug
    rejectUnauthorized: !INSECURE_TLS
  }
});

async function sendBillShareEmail(to, billLink) {
  const subject = 'You have been invited to share a bill';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6">
      <h2>Hi there!</h2>
      <p>You’ve been invited to split a bill with someone on <strong>SplitEasy</strong>.</p>
      <p>Click the button below to view the shared bill:</p>
      <a href="${billLink}" style="background:#4CAF50;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">View Bill</a>
      <p>If the button doesn’t work, use this link:</p>
      <p><a href="${billLink}">${billLink}</a></p>
      <hr />
      <p style="font-size:0.9em;color:#999;">This email was sent automatically by SplitEasy.</p>
    </div>
  `;

  
  // await transporter.verify();

  const info = await transporter.sendMail({
    from: `"SplitEasy App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });

  console.log('Email sent:', info.messageId, info.response);
  return info;
}

module.exports = sendBillShareEmail;
