export const otpTemplate = async (userData, otp) => {
    const { first_name, last_name, email } = userData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Verification - BookByAgent</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background-color: #F5F5DC;
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #F5F5DC;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .dots {
            display: flex;
            justify-content: center;
            margin-bottom: 15px;
        }
        
        .dot {
            width: 8px;
            height: 8px;
            background-color: #90EE90;
            border-radius: 50%;
            margin: 0 4px;
        }
        
        .subtitle {
            color: #90EE90;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        
        .title {
            color: #2C3E50;
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 30px;
        }
        
        .otp-card {
            background: linear-gradient(135deg, #228B22, #32CD32);
            border-radius: 15px;
            padding: 40px;
            margin-bottom: 20px;
            color: white;
            box-shadow: 0 8px 25px rgba(34, 139, 34, 0.3);
            text-align: center;
        }
        
        .otp-icon {
            width: 80px;
            height: 80px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 25px;
            font-size: 32px;
        }
        
        .otp-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        
        .otp-text {
            font-size: 16px;
            margin-bottom: 30px;
            opacity: 0.9;
        }
        
        .otp-code {
            background-color: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 15px;
            padding: 20px;
            margin: 25px 0;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            color: white;
            text-align: center;
            font-family: 'Courier New', monospace;
        }
        
        .info-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .info-card {
            background-color: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        
        .info-icon {
            width: 50px;
            height: 50px;
            background-color: #90EE90;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 20px;
            color: white;
        }
        
        .info-title {
            color: #2C3E50;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .info-description {
            color: #666;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .action-button {
            background-color: #32CD32;
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            cursor: pointer;
            margin: 0 auto;
        }
        
        .action-button:hover {
            background-color: #228B22;
            transform: translateY(-2px);
        }
        
        .user-info {
            background-color: white;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        .user-info-title {
            color: #2C3E50;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .user-details {
            color: #666;
            font-size: 14px;
            text-align: center;
        }
        
        .security-notice {
            background-color: #FFF8DC;
            border-left: 4px solid #FFD700;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            color: #8B4513;
        }
        
        .security-notice-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #8B4513;
        }
        
        .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
        }
        
        @media (max-width: 600px) {
            .info-cards {
                grid-template-columns: 1fr;
            }
            
            .title {
                font-size: 24px;
            }
            
            .otp-card {
                padding: 30px 20px;
            }
            
            .otp-code {
                font-size: 24px;
                letter-spacing: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
            <div class="subtitle">VERIFICATION CODE</div>
            <h1 class="title">OTP Verification</h1>
        </div>
        
        <div class="otp-card">
            <div class="otp-icon">🔐</div>
            <div class="otp-title">Your Verification Code</div>
            <div class="otp-text">
                Please use the following code to verify your account. This code will expire in 10 minutes.
            </div>
            <div class="otp-code">${otp}</div>
            <div style="text-align: center;">
                <a href="#" class="action-button">
                    VERIFY NOW →
                </a>
            </div>
        </div>
        
        <div class="info-cards">
            <div class="info-card">
                <div class="info-icon">⏰</div>
                <div class="info-title">Valid for 10 Minutes</div>
                <div class="info-description">
                    This OTP code will expire in 10 minutes for security purposes. Please use it promptly.
                </div>
            </div>
            
            <div class="info-card">
                <div class="info-icon">🔒</div>
                <div class="info-title">Secure Verification</div>
                <div class="info-description">
                    This code is unique to your account and should not be shared with anyone.
                </div>
            </div>
            
            <div class="info-card">
                <div class="info-icon">📱</div>
                <div class="info-title">One-Time Use</div>
                <div class="info-description">
                    This code can only be used once. If you need a new code, please request another one.
                </div>
            </div>
        </div>
        
        <div class="user-info">
            <div class="user-info-title">Verification Details</div>
            <div class="user-details">
                <strong>Name:</strong> ${first_name} ${last_name}<br>
                <strong>Email:</strong> ${email}<br>
                <strong>Requested at:</strong> ${new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}
            </div>
        </div>
        
        <div class="security-notice">
            <div class="security-notice-title">⚠️ Security Notice</div>
            <p>Never share this OTP code with anyone. BookByAgent will never ask for your verification code via phone, email, or any other method. If you didn't request this code, please ignore this email and contact our support team immediately.</p>
        </div>
        
        <div class="footer">
            <p>This is an automated message from BookByAgent</p>
            <p>If you have any questions, please contact our support team</p>
        </div>
    </div>
</body>
</html>
  `;
};


