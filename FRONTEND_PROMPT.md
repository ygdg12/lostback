# Frontend Implementation: Security Officer Verification Code System

## What to Implement

Add a verification code system for security officer (staff) signup. Regular users don't need codes.

## API Endpoints

### 1. Admin: Generate Verification Code
```
POST /api/admin/verification-codes
Headers: Authorization: Bearer <admin_token>
Response: { code: "ABC12345", expiresAt: "2024-01-15T10:00:00Z" }
```

### 2. Admin: View All Codes
```
GET /api/admin/verification-codes
Headers: Authorization: Bearer <admin_token>
Response: { codes: [{ code, isUsed, usedBy, expiresAt, ... }] }
```

### 3. Signup (Updated)
```
POST /api/auth/signup
Body: {
  name, email, password,
  role: "staff",  // or "user"
  verificationCode: "ABC12345"  // REQUIRED if role is "staff"
}
```

## Frontend Requirements

### For Admin Dashboard:
1. **Generate Code Button** - Creates new code, shows it in a modal/alert
2. **Codes List** - Display all codes with:
   - Code value
   - Status (Used/Unused)
   - Expiration date
   - Who used it (if used)
   - Delete button

### For Signup Page:
1. **Role Selection** - User selects "Security Officer" or "Regular User"
2. **Conditional Field** - If "Security Officer" selected:
   - Show "Verification Code" input field
   - Make it required
   - Add validation
3. **Error Messages**:
   - "Verification code is required for security officer registration"
   - "Invalid verification code"
   - "Verification code has already been used"
   - "Verification code has expired"

## Example Flow

1. Admin logs in → Goes to admin panel
2. Admin clicks "Generate Code" → Gets code like "ABC12345"
3. Admin shares code with security officer
4. Security officer goes to signup page
5. Selects "Security Officer" role
6. Enters verification code + other details
7. Submits → Account created with staff role

## Notes

- Regular users (role: "user") don't need verification codes
- Only staff role requires verification code
- Codes expire after 7 days
- Each code can only be used once

