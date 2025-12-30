# Quick Test Guide - Firebase Auth Integration

## 🎯 Quick Test (5 minutes)

### Step 1: Open Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **sayhadrid**
3. Open **Authentication** tab in left sidebar
4. Keep this tab open to see new users appear

### Step 2: Add Employee via SuperAdmin
1. In your app, login as SuperAdmin
2. Click **"Production"** → **"Add Employee"**
3. Fill in the form:
   ```
   Name: Test User
   Email: testuser@example.com
   Password: test123456
   Department: Video
   Role: Employee
   ```
4. Click **"Create Employee"**

### Step 3: Verify Success
✅ **Check 1**: Success toast appears: "Employee Test User added successfully with Firebase Auth account!"

✅ **Check 2**: In Firebase Console → Authentication, you should see:
   - New user: testuser@example.com
   - UID: (some random string like "abc123xyz...")

✅ **Check 3**: In Firebase Console → Realtime Database → employees:
   - Find the new employee entry
   - Verify it has a `firebaseUid` field matching the UID from Authentication

✅ **Check 4**: SuperAdmin is still logged in (not logged out)

### Step 4: Test Employee Login
1. Logout from SuperAdmin
2. Go to login page
3. Login with:
   ```
   Email: testuser@example.com
   Password: test123456
   ```
4. ✅ Should successfully login to employee dashboard

## 🧪 Test Different Scenarios

### Scenario A: Duplicate Email
1. Try adding another employee with email: testuser@example.com
2. ✅ Should show error: "This email is already registered in Firebase Authentication"

### Scenario B: Weak Password
1. Try adding employee with password: "123" (less than 6 chars)
2. ✅ Should show error: "Password must be at least 6 characters long"

### Scenario C: Production In-charge
1. Login as Production In-charge
2. Navigate to "Add Employee"
3. Add a new employee
4. ✅ Should work exactly like SuperAdmin

## 📸 What You Should See

### Before (Old Behavior):
- Employee added to database only
- NOT visible in Firebase Authentication
- Could NOT login with email/password

### After (New Behavior):
- Employee added to BOTH database AND Firebase Authentication
- ✅ Visible in Firebase Authentication console
- ✅ Can login with email/password
- ✅ Has firebaseUid stored in database

## 🔍 Debugging

### If employee is NOT appearing in Firebase Authentication:
1. Open browser console (F12)
2. Look for errors starting with "Creating Firebase Auth account..."
3. Check if you see "✅ Firebase Auth account created: [UID]"
4. If you see errors, check:
   - Internet connection
   - Firebase project permissions
   - Email format is valid

### If you get "auth/email-already-in-use":
- This email is already registered
- Go to Firebase Console → Authentication
- Delete the existing user or use a different email

### If current user gets logged out:
- This should NOT happen with the new implementation
- If it does, check that code uses `secondaryAuth` not `auth`

## ✨ Success Criteria

Your implementation is working correctly if:
1. ✅ New employees appear in Firebase Authentication
2. ✅ New employees can login with their credentials
3. ✅ Database entries have `firebaseUid` field
4. ✅ Admin/Production In-charge stays logged in after adding employee
5. ✅ Proper error messages for duplicate emails and weak passwords

## 📞 Need Help?

If something isn't working:
1. Check browser console for errors
2. Verify Firebase project settings
3. Ensure internet connection is stable
4. Review FIREBASE_AUTH_INTEGRATION.md for detailed troubleshooting
