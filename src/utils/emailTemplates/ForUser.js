export const forUserTemplate = async (userData) => {
    const { first_name, last_name, email, agency_name, city } = userData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Status - BookByAgent</title>
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
            max-width: 800px;
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
        
        .status-card {
            background: linear-gradient(135deg, #FFA500, #FFD700);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 20px;
            color: white;
            box-shadow: 0 8px 25px rgba(255, 165, 0, 0.3);
        }
        
        .status-icon {
            width: 60px;
            height: 60px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            font-size: 24px;
        }
        
        .status-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        
        .status-text {
            font-size: 16px;
            margin-bottom: 25px;
            opacity: 0.9;
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
            
            .status-card {
                padding: 20px;
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
            <div class="subtitle">ACCOUNT STATUS UPDATE</div>
            <h1 class="title">Your Account Status</h1>
        </div>
        
        <div class="status-card">
            <div class="status-icon">⏳</div>
            <div class="status-title">Account Status: Pending</div>
            <div class="status-text">
                Your account registration has been received and is currently under review. We'll notify you once your account is approved.
            </div>
            <div style="text-align: center;">
                <a href="#" class="action-button">
                    CHECK STATUS →
                </a>
            </div>
        </div>
        
        <div class="info-cards">
            <div class="info-card">
                <div class="info-icon">📋</div>
                <div class="info-title">Review Process</div>
                <div class="info-description">
                    Our team is reviewing your registration details and will approve your account within 24-48 hours.
                </div>
            </div>
            
            <div class="info-card">
                <div class="info-icon">📧</div>
                <div class="info-title">Email Notification</div>
                <div class="info-description">
                    You'll receive an email notification once your account is approved and ready to use.
                </div>
            </div>
            
            <div class="info-card">
                <div class="info-icon">🔒</div>
                <div class="info-title">Secure Platform</div>
                <div class="info-description">
                    Your information is secure and will only be used for account verification purposes.
                </div>
            </div>
        </div>
        
        <div class="user-info">
            <div class="user-info-title">Your Registration Details</div>
            <div class="user-details">
                <strong>Name:</strong> ${first_name} ${last_name}<br>
                <strong>Email:</strong> ${email}<br>
                ${agency_name ? `<strong>Agency:</strong> ${agency_name}<br>` : ''}
                ${city ? `<strong>City:</strong> ${city}` : ''}
            </div>
        </div>
        
        <div class="footer">
            <p>Thank you for choosing BookByAgent</p>
            <p>If you have any questions, please contact our support team</p>
        </div>
    </div>
</body>
</html>
  `;
};

