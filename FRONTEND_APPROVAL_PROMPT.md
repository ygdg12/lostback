# Frontend Implementation: User Approval System

## What to Implement

Add an admin approval system where regular users must be approved by admin before they can access the homepage. Security officers (staff) and admins are auto-approved.

## User Status Flow

1. **User signs up** → Status: "pending"
2. **User tries to sign in** → Blocked with message: "Your account is pending approval"
3. **Admin approves/rejects** → User status changes
4. **User signs in** → Allowed only if status is "approved"

## API Endpoints

### 1. Signup (Updated Response)
```
POST /api/auth/signup
Body: { name, email, password, role: "user" }
Response: { 
  message: "Account created successfully. Please wait for admin approval...",
  user: { ..., status: "pending" }
}
```

### 2. Signin (Updated - Blocks Pending Users)
```
POST /api/auth/signin
Body: { email, password }
Response (if pending): { 
  message: "Your account is pending approval. Please wait for admin approval.",
  status: "pending"
}
Response (if rejected): { 
  message: "Your account has been rejected. Please contact support.",
  status: "rejected",
  reason: "..."
}
Response (if approved): { token, user: { ..., status: "approved" } }
```

### 2b. Get Current User
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { user: { id, name, email, role, status, ... } }
```

### 3. Admin: View Pending Users
```
GET /api/admin/users/pending
Headers: Authorization: Bearer <admin_token>
Response: { users: [{ id, name, email, studentId, phone, createdAt, ... }] }
```

### 4. Admin: View All Users (with status filter)
```
GET /api/admin/users?status=pending
GET /api/admin/users?status=approved
GET /api/admin/users?status=rejected
Headers: Authorization: Bearer <admin_token>
Response: { users: [...] }
```

### 5. Admin: Approve User
```
PATCH /api/admin/users/:id/approve
Headers: Authorization: Bearer <admin_token>
Response: { message: "User approved successfully", user: {...} }
```

### 6. Admin: Reject User
```
PATCH /api/admin/users/:id/reject
Headers: Authorization: Bearer <admin_token>
Body: { reason: "Invalid student ID" } // optional
Response: { message: "User rejected successfully", user: {...} }
```

## Frontend Requirements

### For Signup Page:
1. **After successful signup:**
   - Show message: "Account created successfully! Please wait for admin approval before signing in."
   - Don't auto-login the user
   - Redirect to signin page with info message

### For Signin Page:
1. **Handle pending status:**
   - If response has `status: "pending"`:
     - Show message: "Your account is pending approval. Please wait for admin approval."
     - Don't allow signin
     - Show a waiting/loading state

2. **Handle rejected status:**
   - If response has `status: "rejected"`:
     - Show message: "Your account has been rejected. Please contact support."
     - Show rejection reason if available
     - Don't allow signin

3. **Handle approved status:**
   - Normal signin flow
   - Redirect to homepage

### For Admin Dashboard:
1. **Pending Users Section:**
   - List all users with status "pending"
   - Show: Name, Email, Student ID, Phone, Signup Date
   - For each user, show:
     - "Approve" button
     - "Reject" button (with optional reason input)

2. **User Management Page:**
   - Tabs/Filter: All / Pending / Approved / Rejected
   - Show user status badge (Pending/Approved/Rejected)
   - Approve/Reject actions for pending users
   - View rejection reason for rejected users

3. **Approve Action:**
   - Click "Approve" → Confirm → Call API → Update UI
   - Show success message

4. **Reject Action:**
   - Click "Reject" → Show modal with optional reason input
   - Submit → Call API → Update UI
   - Show success message

### For Protected Routes:
1. **Check user status on app load:**
   - Call `GET /api/auth/me` to get current user
   - **IMPORTANT:** Pending page should ONLY show for:
     - Regular users (role: "user") 
     - With status: "pending"
   - **DO NOT show pending page for:**
     - Admin users (role: "admin") - they are always approved
     - Staff users (role: "staff") - they are always approved
   - If regular user status is "pending" or "rejected":
     - Show pending/rejected page
     - Block access to other pages
   - Only allow access if status is "approved" OR role is "admin" or "staff"

## User Status Values

- `"pending"` - Waiting for admin approval
- `"approved"` - Can access system
- `"rejected"` - Account rejected, cannot access

## Important Notes

- **Staff users** (security officers) are auto-approved - no approval needed
- **Admin users** are auto-approved
- **Regular users** (role: "user") require approval
- User object now includes `status` field in all responses
- Check `user.status` before allowing access to protected routes

## Example Flow

1. User signs up → Sees "Wait for approval" message
2. User tries to sign in → Sees "Pending approval" message
3. Admin views pending users → Sees list
4. Admin clicks "Approve" → User can now sign in
5. User signs in → Redirected to homepage


