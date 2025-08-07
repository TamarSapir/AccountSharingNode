// utils/sendEmail.js

const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  host: "out.walla.co.il",
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER, // walla email from env
    pass: process.env.EMAIL_PASS  // walla password from env
  },
  tls: {
    rejectUnauthorized: false 
  }
});


/**
 * Send a standard "bill share" email
 * @param {string} to - recipient email
 * @param {string} billLink - full URL to view the bill
 */
async function sendBillShareEmail(to, billLink) {
  const subject = 'You have been invited to share a bill';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6">
      <h2>Hi there! </h2>
      <p>You’ve been invited to split a bill with someone on <strong>SplitEasy</strong>.</p>
      <p>Click the button below to view the shared bill:</p>
      <a href="${billLink}" style="background: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">View Bill</a>
      <p>If the button doesn’t work, use this link:</p>
      <p><a href="${billLink}">${billLink}</a></p>
      <hr />
      <p style="font-size: 0.9em; color: #999;">This email was sent automatically by SplitEasy.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"SplitEasy App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
}

module.exports = sendBillShareEmail;