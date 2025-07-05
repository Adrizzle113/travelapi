const crypto = require('crypto');
const mailgun = require('mailgun-js');

// Initialize Mailgun
const mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN
});

/**
 * Verify Mailgun webhook signature
 */
function verifyMailgunSignature(timestamp, token, signature) {
  if (!process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.warn('⚠️ No webhook signing key configured, skipping verification');
    return true; // Allow for development
  }
  
  const value = timestamp + token;
  const hash = crypto
    .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(value)
    .digest('hex');
  
  return hash === signature;
}

/**
 * Process incoming email from RateHawk
 */
async function processIncomingEmail(emailData) {
  console.log('📧 Processing incoming email...');
  console.log(`From: ${emailData.sender}`);
  console.log(`To: ${emailData.recipient}`);
  console.log(`Subject: ${emailData.subject}`);
  
  try {
    // Extract user ID from email address
    const emailMatch = emailData.recipient.match(/rh_([^_]+)_/);
    const userId = emailMatch ? emailMatch[1] : null;
    
    if (!userId) {
      console.warn('⚠️ Could not extract user ID from email:', emailData.recipient);
      return { success: false, error: 'Invalid email format' };
    }
    
    console.log(`👤 Extracted user ID: ${userId}`);
    
    // Check if this is from RateHawk
    const isFromRateHawk = emailData.sender.includes('ratehawk') || 
                          emailData.sender.includes('noreply') ||
                          emailData.subject.toLowerCase().includes('welcome') ||
                          emailData.subject.toLowerCase().includes('confirmation');
    
    if (!isFromRateHawk) {
      console.log('📋 Email not from RateHawk, ignoring');
      return { success: false, error: 'Not a RateHawk email' };
    }
    
    // Extract confirmation/reset links from email body
    const links = extractLinksFromEmail(emailData.bodyHtml || emailData.bodyPlain);
    
    // Store email data for processing
    const emailRecord = {
      userId: userId,
      recipient: emailData.recipient,
      sender: emailData.sender,
      subject: emailData.subject,
      bodyHtml: emailData.bodyHtml,
      bodyPlain: emailData.bodyPlain,
      links: links,
      timestamp: new Date(),
      processed: false
    };
    
    // Store in global map for now (in production, use database)
    if (!global.pendingEmails) {
      global.pendingEmails = new Map();
    }
    
    global.pendingEmails.set(userId, emailRecord);
    
    console.log(`✅ Email stored for user ${userId}`);
    console.log(`🔗 Found ${links.length} links in email`);
    
    // If this looks like a confirmation email, trigger completion
    if (isConfirmationEmail(emailData)) {
      console.log('🎯 This appears to be a confirmation email');
      // Trigger async processing
      setImmediate(() => completeAccountSetup(userId, emailRecord));
    }
    
    return {
      success: true,
      userId: userId,
      emailType: isConfirmationEmail(emailData) ? 'confirmation' : 'other',
      linksFound: links.length
    };
    
  } catch (error) {
    console.error('💥 Email processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract links from email content
 */
function extractLinksFromEmail(content) {
  if (!content) return [];
  
  const linkRegex = /https?:\/\/[^\s<>"']+/gi;
  const matches = content.match(linkRegex) || [];
  
  // Filter for RateHawk links
  const ratehawkLinks = matches.filter(link => 
    link.includes('ratehawk.com') || 
    link.includes('confirm') || 
    link.includes('activate') ||
    link.includes('reset')
  );
  
  return ratehawkLinks;
}

/**
 * Determine if email is a confirmation email
 */
function isConfirmationEmail(emailData) {
  const subject = emailData.subject.toLowerCase();
  const body = (emailData.bodyPlain || emailData.bodyHtml || '').toLowerCase();
  
  const confirmationKeywords = [
    'welcome',
    'confirm',
    'activate',
    'verification',
    'account created',
    'set password',
    'complete registration'
  ];
  
  return confirmationKeywords.some(keyword => 
    subject.includes(keyword) || body.includes(keyword)
  );
}

/**
 * Complete account setup after receiving confirmation email
 */
async function completeAccountSetup(userId, emailRecord) {
  console.log(`🔧 Starting account setup completion for user ${userId}`);
  
  try {
    // Find the main confirmation/activation link
    const confirmationLink = emailRecord.links.find(link => 
      link.includes('confirm') || 
      link.includes('activate') || 
      link.includes('verify')
    );
    
    if (confirmationLink) {
      console.log(`🔗 Found confirmation link: ${confirmationLink}`);
      
      // Visit the confirmation link using Browserless
      const { visitConfirmationLink } = require('./ratehawkSignupService');
      await visitConfirmationLink(confirmationLink);
    }
    
    // Trigger password reset
    const { resetRateHawkPassword } = require('./ratehawkSignupService');
    await resetRateHawkPassword(emailRecord.recipient, 'TempPassword123!');
    
    // Mark as processed
    emailRecord.processed = true;
    emailRecord.completedAt = new Date();
    
    console.log(`✅ Account setup completed for user ${userId}`);
    
    // Here you would typically:
    // 1. Send final email to user's real email with credentials
    // 2. Update user record in database
    // 3. Trigger any additional setup steps
    
  } catch (error) {
    console.error(`💥 Account setup failed for user ${userId}:`, error);
  }
}

/**
 * Send notification email to user's real email
 */
async function sendUserNotification(userEmail, credentials) {
  console.log(`📤 Sending notification to ${userEmail}`);
  
  const emailContent = {
    from: 'Your Travel Service <noreply@yourdomain.com>',
    to: userEmail,
    subject: 'Your Account is Ready!',
    html: `
      <h2>Welcome! Your account has been created successfully.</h2>
      <p>You can now access your travel booking portal with these credentials:</p>
      <p><strong>Email:</strong> ${credentials.email}</p>
      <p><strong>Password:</strong> ${credentials.password}</p>
      <p><a href="https://yourdomain.com/login">Login to your account</a></p>
      <p>Best regards,<br>Your Travel Team</p>
    `,
    text: `
      Welcome! Your account has been created successfully.
      
      Email: ${credentials.email}
      Password: ${credentials.password}
      
      Login at: https://yourdomain.com/login
      
      Best regards,
      Your Travel Team
    `
  };
  
  try {
    const result = await mg.messages().send(emailContent);
    console.log('✅ Notification email sent:', result.id);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('💥 Failed to send notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending emails for a user
 */
function getPendingEmails(userId) {
  if (!global.pendingEmails) {
    return [];
  }
  
  return Array.from(global.pendingEmails.values())
    .filter(email => email.userId === userId);
}

module.exports = {
  verifyMailgunSignature,
  processIncomingEmail,
  sendUserNotification,
  getPendingEmails
};