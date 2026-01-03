# CRITICAL FRONTEND FIX: Pending Page Blocking All Users

## The Problem

When one user is on the pending page, the system shows the pending page for ALL users (including admin/staff), preventing them from logging in.

## Root Cause

The frontend is likely:
1. Checking pending status globally (not per-user)
2. Using shared state/localStorage that persists across different users
3. Not clearing user data when a new user signs in
4. Checking pending status before verifying which user is logged in

## Backend Status (Verified ✅)

The backend is CORRECT:
- Admin can sign in → Returns `{ role: "admin", status: "approved" }`
- Staff can sign in → Returns `{ role: "staff", status: "approved" }`
- Regular pending user → Returns `{ role: "user", status: "pending" }`

## Frontend Fix Required

### 1. ALWAYS Check Current User's Role and Status

**CRITICAL:** Never check pending status globally. Always check the CURRENT logged-in user's role and status.

```javascript
// ❌ WRONG - Don't do this:
if (localStorage.getItem("userStatus") === "pending") {
  showPendingPage();
}

// ✅ CORRECT - Always check current user:
const currentUser = await getCurrentUser(); // From /api/auth/me
if (currentUser.role === "user" && currentUser.status === "pending") {
  showPendingPage();
}
```

### 2. Clear State on Signin/Signout

**Location:** Signin component, Signout function

```javascript
// When user signs in
const handleSignin = async (email, password) => {
  const response = await fetch("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  
  // CRITICAL: Clear old user data first
  localStorage.removeItem("user");
  localStorage.removeItem("userStatus");
  localStorage.removeItem("pending");
  
  // Store NEW user data
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  
  // Check THIS user's status
  if (data.user.role === "user" && data.user.status === "pending") {
    navigate("/pending");
  } else {
    // Admin/Staff/Approved users → Go to their dashboard
    navigate("/homepage");
  }
};

// When user signs out
const handleSignout = () => {
  // Clear ALL user data
  localStorage.clear();
  // or specifically:
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("userStatus");
  navigate("/signin");
};
```

### 3. Check User on App Load (Not Global State)

**Location:** App.js, main component, route guard

```javascript
// ❌ WRONG - Don't check localStorage status directly:
useEffect(() => {
  const status = localStorage.getItem("userStatus");
  if (status === "pending") {
    navigate("/pending");
  }
}, []);

// ✅ CORRECT - Always fetch current user from API:
useEffect(() => {
  const checkUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/signin");
      return;
    }
    
    try {
      // Fetch CURRENT user from backend
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        localStorage.clear();
        navigate("/signin");
        return;
      }
      
      const data = await response.json();
      const currentUser = data.user;
      
      // Check THIS user's role and status
      if (currentUser.role === "user" && currentUser.status === "pending") {
        navigate("/pending");
      } else {
        // Admin/Staff/Approved → Allow access
        setUser(currentUser);
        navigate("/homepage");
      }
    } catch (error) {
      localStorage.clear();
      navigate("/signin");
    }
  };
  
  checkUser();
}, []);
```

### 4. Fix PendingPage Component

**Location:** PendingPage.jsx

```javascript
// ❌ WRONG - Don't show pending page for everyone:
const PendingPage = () => {
  return <div>Waiting for approval...</div>;
};

// ✅ CORRECT - Check current user first:
const PendingPage = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchCurrentUser = async () => {
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
        const currentUser = data.user;
        
        // CRITICAL: Only show pending page for regular users with pending status
        if (currentUser.role !== "user" || currentUser.status !== "pending") {
          // User is NOT a pending regular user → Redirect
          if (currentUser.role === "admin") {
            navigate("/admin-dashboard");
          } else if (currentUser.role === "staff") {
            navigate("/staff-dashboard");
          } else if (currentUser.status === "approved") {
            navigate("/homepage");
          } else if (currentUser.status === "rejected") {
            navigate("/rejected");
          }
          return;
        }
        
        // User IS a pending regular user → Show pending page
        setUser(currentUser);
      } catch (error) {
        console.error("Error:", error);
        navigate("/signin");
      }
    };
    
    fetchCurrentUser();
  }, [navigate]);
  
  if (!user) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Waiting for Approval</h1>
      <p>Your account is pending admin approval.</p>
    </div>
  );
};
```

### 5. Fix Route Protection

**Location:** Route guard, ProtectedRoute component

```javascript
// ❌ WRONG - Global pending check:
const ProtectedRoute = ({ children }) => {
  const status = localStorage.getItem("userStatus");
  if (status === "pending") {
    return <Navigate to="/pending" />;
  }
  return children;
};

// ✅ CORRECT - Check current user:
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkUser = async () => {
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
        const currentUser = data.user;
        
        // Only block if THIS user is a pending regular user
        if (currentUser.role === "user" && currentUser.status === "pending") {
          navigate("/pending");
          return;
        }
        
        // Allow access for admin/staff/approved users
        setUser(currentUser);
      } catch (error) {
        navigate("/signin");
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  if (!user) return null;
  
  return children;
};
```

### 6. Fix Navigation/Routing Logic

**Location:** Navigation component, route definitions

```javascript
// ❌ WRONG - Show pending link for everyone:
<nav>
  <Link to="/pending">Pending</Link>
</nav>

// ✅ CORRECT - Only show for pending regular users:
const Navigation = () => {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Fetch current user
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        setUser(data.user);
      }
    };
    fetchUser();
  }, []);
  
  return (
    <nav>
      {user?.role === "user" && user?.status === "pending" && (
        <Link to="/pending">Pending Approval</Link>
      )}
      {/* Other nav items */}
    </nav>
  );
};
```

## Complete Fix Checklist

1. ✅ **Clear localStorage on signin** - Remove old user data before storing new
2. ✅ **Always fetch current user from `/api/auth/me`** - Don't trust localStorage
3. ✅ **Check `user.role === "user" && user.status === "pending"`** - Not just status
4. ✅ **Redirect admin/staff immediately** - Don't show pending page
5. ✅ **Clear state on signout** - Remove all user data
6. ✅ **Check user on app load** - Fetch from API, not localStorage
7. ✅ **Fix PendingPage component** - Redirect if user is not pending regular user

## Testing Steps

1. **Test Admin Signin:**
   - Admin signs in → Should go to admin dashboard (NOT pending page)

2. **Test Staff Signin:**
   - Staff signs in → Should go to staff dashboard (NOT pending page)

3. **Test Regular User Signup:**
   - Regular user signs up → Should see pending page

4. **Test After Approval:**
   - Admin approves user → User signs in → Should go to homepage (NOT pending page)

5. **Test Multiple Users:**
   - User A (pending) signs in → Sees pending page
   - User A signs out
   - Admin signs in → Should see admin dashboard (NOT pending page)

## Key Principle

**NEVER check pending status globally. ALWAYS check the CURRENT logged-in user's role and status from the API.**

