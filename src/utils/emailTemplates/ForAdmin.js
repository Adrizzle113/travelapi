export const forAdminTemplate = async (userData) => {
    const { first_name, last_name, email, phone_number, agency_name, legal_name, city, address, itn, created_at } = userData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New User Registration - BookByAgent</title>
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
        
        .notification-card {
            background: linear-gradient(135deg, #228B22, #32CD32);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 20px;
            color: white;
            box-shadow: 0 8px 25px rgba(34, 139, 34, 0.3);
        }
        
        .notification-icon {
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
        
        .notification-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        
        .notification-text {
            font-size: 16px;
            margin-bottom: 25px;
            opacity: 0.9;
        }
        
        .user-details-card {
            background-color: white;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        .user-details-title {
            color: #2C3E50;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .detail-item {
            display: flex;
            flex-direction: column;
        }
        
        .detail-label {
            color: #90EE90;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .detail-value {
            color: #2C3E50;
            font-size: 14px;
            font-weight: 500;
        }
        
        .full-width {
            grid-column: 1 / -1;
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
        }
        
        .action-button:hover {
            background-color: #228B22;
            transform: translateY(-2px);
        }
        
        .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
        }
        
        @media (max-width: 600px) {
            .details-grid {
                grid-template-columns: 1fr;
            }
            
            .title {
                font-size: 24px;
            }
            
            .notification-card {
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
            <div class="subtitle">ADMIN NOTIFICATION</div>
            <h1 class="title">New User Registration</h1>
        </div>
        
        <div class="notification-card">
            <div class="notification-icon">👤</div>
            <div class="notification-title">New User Registration</div>
            <div class="notification-text">
                A new user has registered on BookByAgent platform. Please review the details below and take necessary action.
            </div>
            <a href="#" class="action-button">
                REVIEW USER DETAILS →
            </a>
        </div>
        
        <div class="user-details-card">
            <div class="user-details-title">User Registration Details</div>
            <div class="details-grid">
                <div class="detail-item">
                    <div class="detail-label">Full Name</div>
                    <div class="detail-value">${first_name} ${last_name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email Address</div>
                    <div class="detail-value">${email}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Phone Number</div>
                    <div class="detail-value">${phone_number || 'Not provided'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Agency Name</div>
                    <div class="detail-value">${agency_name || 'Not provided'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Legal Name</div>
                    <div class="detail-value">${legal_name || 'Not provided'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">City</div>
                    <div class="detail-value">${city || 'Not provided'}</div>
                </div>
                <div class="detail-item full-width">
                    <div class="detail-label">Address</div>
                    <div class="detail-value">${address || 'Not provided'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">ITN Number</div>
                    <div class="detail-value">${itn || 'Not provided'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Registration Date</div>
                    <div class="detail-value">${new Date(created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}</div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from BookByAgent Admin Panel</p>
            <p>Please do not reply to this email</p>
        </div>
    </div>
</body>
</html>
  `;
};


