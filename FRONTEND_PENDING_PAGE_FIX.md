# Frontend Fix: Pending Page Should Only Show for Regular Users

## Critical Rule

**ONLY regular users (role: "user") with status "pending" should see the pending page.**

**Staff (role: "staff") and Admin (role: "admin") are ALWAYS auto-approved and should NEVER see the pending page.**

## Backend Behavior

### Who Needs Approval?
- ✅ **Regular users (role: "user")** → Status: "pending" → Need admin approval
- ❌ **Staff (role: "staff")** → Status: "approved" → Auto-approved, no approval needed
- ❌ **Admin (role: "admin")** → Status: "approved" → Auto-approved, no approval needed

### User Status After Signup
- Regular user signs up → `status: "pending"` → Must wait for admin approval
- Staff signs up (with verification code) → `status: "approved"` → Can access immediately
- Admin → `status: "approved"` → Can access immediately

## Frontend Changes Required

### 1. Check User Status After Signin/Signup

**Location:** After successful signin or signup, when you get user data

```javascript
// After signin/signup, check user data
const user = response.user; // or response.data.user

// ONLY show pending page if:
// 1. User role is "user" (regular user)
// 2. User status is "pending"
if (user.role === "user" && user.status === "pending") {
  // Show pending page
  navigate("/pending");
} else {
  // All other cases: Allow normal access
  // - Staff (role: "staff") → Always approved
  // - Admin (role: "admin") → Always approved
  // - Regular users with status "approved" → Approved
  navigate("/homepage"); // or wherever
}
```

### 2. Check User Status on App Load

**Location:** When app initializes/loads, after checking localStorage or fetching `/api/auth/me`

```javascript
// Fetch current user
const response = await fetch("/api/auth/me", {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await response.json();
const user = data.user;

// Check if user should see pending page
if (user.role === "user" && user.status === "pending") {
  // Show pending page
  setCurrentPage("pending");
} else {
  // All other users: Allow normal access
  setCurrentPage("homepage");
}
```

### 3. Protected Route Guard

**Location:** In your route protection/guard component

```javascript
// Before allowing access to protected routes
const checkUserAccess = (user) => {
  // ONLY block if: regular user AND pending
  if (user.role === "user" && user.status === "pending") {
    return { allowed: false, redirect: "/pending" };
  }
  
  // Block if rejected
  if (user.status === "rejected") {
    return { allowed: false, redirect: "/rejected" };
  }
  
  // Allow access for:
  // - Staff (always approved)
  // - Admin (always approved)
  // - Regular users with status "approved"
  return { allowed: true };
};
```

### 4. PendingPage Component Logic

**Location:** Inside your PendingPage component

```javascript
// At the top of PendingPage component
useEffect(() => {
  // Fetch current user
  const fetchUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/signin");
      return;
    }
    
    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      const user = data.user;
      
      // CRITICAL: Only show pending page for regular users with pending status
      if (user.role !== "user" || user.status !== "pending") {
        // User is not a pending regular user
        // Redirect based on their actual status
        if (user.role === "admin" || user.role === "staff") {
          navigate("/admin-dashboard"); // or wherever admin/staff go
        } else if (user.status === "approved") {
          navigate("/homepage");
        } else if (user.status === "rejected") {
          navigate("/rejected");
        }
        return;
      }
      
      // User is a regular user with pending status - show pending page
      setUser(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      navigate("/signin");
    }
  };
  
  fetchUser();
}, []);
```

### 5. Remove Pending Page from Navigation/All Pages

**Location:** Navigation component, route definitions

```javascript
// DO NOT show pending page link in navigation
// DO NOT allow navigation to pending page for non-pending users

// In your navigation/routing logic:
const routes = [
  { path: "/homepage", component: HomePage },
  { path: "/admin", component: AdminDashboard },
  { path: "/staff", component: StaffDashboard },
  // Only show pending route if user is actually pending
  ...(user?.role === "user" && user?.status === "pending" 
    ? [{ path: "/pending", component: PendingPage }]
    : []
  ),
];
```

## Exact Conditions for Pending Page

### Show Pending Page ONLY When:
```javascript
user.role === "user" && user.status === "pending"
```

### Do NOT Show Pending Page When:
```javascript
// Staff users
user.role === "staff" // Always approved

// Admin users
user.role === "admin" // Always approved

// Approved regular users
user.role === "user" && user.status === "approved"

// Rejected users
user.status === "rejected" // Show rejected page instead
```

## Complete Example: User Status Check Function

```javascript
// Create a utility function
const getUserRedirectPath = (user) => {
  // Regular user with pending status
  if (user.role === "user" && user.status === "pending") {
    return "/pending";
  }
  
  // Rejected user
  if (user.status === "rejected") {
    return "/rejected";
  }
  
  // Staff users → Staff dashboard
  if (user.role === "staff") {
    return "/staff-dashboard"; // or wherever staff go
  }
  
  // Admin users → Admin dashboard
  if (user.role === "admin") {
    return "/admin-dashboard"; // or wherever admin go
  }
  
  // Approved regular users → Homepage
  if (user.role === "user" && user.status === "approved") {
    return "/homepage";
  }
  
  // Default fallback
  return "/homepage";
};

// Use it after signin/signup
const user = response.user;
const redirectPath = getUserRedirectPath(user);
navigate(redirectPath);
```

## Summary of Frontend Changes

1. ✅ **After signin/signup:** Check `user.role === "user" && user.status === "pending"` before showing pending page
2. ✅ **On app load:** Check user status and only show pending page for pending regular users
3. ✅ **In PendingPage component:** Add check to redirect if user is not a pending regular user
4. ✅ **In route guards:** Only block access for pending regular users
5. ✅ **In navigation:** Don't show pending page link for staff/admin/approved users

## Testing Checklist

- [ ] Regular user signs up → Sees pending page
- [ ] Regular user (pending) tries to access homepage → Redirected to pending page
- [ ] Staff user signs up → Goes directly to staff dashboard (no pending page)
- [ ] Admin signs in → Goes directly to admin dashboard (no pending page)
- [ ] Regular user gets approved → Can access homepage (no pending page)
- [ ] Admin/Staff refresh page → Never see pending page


