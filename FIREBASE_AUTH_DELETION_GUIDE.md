# Firebase Authentication Account Deletion Guide

## Current Implementation

When you delete an employee from the database, the system now:

1. ✅ **Removes employee from Realtime Database**
2. ✅ **Unassigns all their tasks and clients**
3. ✅ **Tracks the Firebase Auth account** that needs manual deletion
4. ⚠️ **Shows warning** with email and UID for manual cleanup

## Why Manual Deletion is Required

**Firebase Security Limitation**: Firebase doesn't allow deleting authentication users from client-side code (browser). This is a security feature to prevent unauthorized account deletions.

**Solutions**:
- **Current**: Manual deletion via Firebase Console (quick, works immediately)
- **Better**: Firebase Cloud Function (automated, requires setup)

---

## Option 1: Manual Deletion (Current Method)

### Step-by-Step Process:

#### 1. Delete Employee in Your App
- Go to SuperAdmin or Production In-charge dashboard
- Click "Delete" on an employee
- Confirm the deletion

#### 2. Note the Information
You'll see a warning toast with:
```
✅ Employee deleted from database!
⚠️ IMPORTANT: Please manually delete their Firebase Auth account:
📧 Email: employee@example.com
🔑 UID: abc123xyz...
```

**Also check browser console (F12)** - the information is logged there for easy copy-paste.

#### 3. Open Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select your project: **sayhadrid**
3. Click **Authentication** in the left sidebar
4. Click **Users** tab

#### 4. Find and Delete the User
**Method A - Search by Email:**
1. Use the search box at the top
2. Type the employee's email
3. Click on the user row
4. Click the **3-dot menu** (⋮) → **Delete account**
5. Confirm deletion

**Method B - Search by UID:**
1. Use Ctrl+F (Find on page)
2. Paste the UID from the warning
3. Find the matching user
4. Click **3-dot menu** (⋮) → **Delete account**
5. Confirm deletion

#### 5. Verify Deletion
- User should disappear from the list
- They can no longer login to your app

### Tracking Deleted Accounts

All deleted accounts are tracked in Firebase Realtime Database under:
```
/deletedAuthAccounts/{firebaseUid}
```

Each entry contains:
- `email`: Employee email
- `employeeName`: Employee name
- `deletedAt`: When they were deleted
- `deletedBy`: Who deleted them (SuperAdmin/Production Incharge)
- `note`: Reminder for manual deletion

**To view pending deletions:**
1. Go to Firebase Console → Realtime Database
2. Navigate to `/deletedAuthAccounts`
3. See list of all accounts awaiting manual deletion

---

## Option 2: Automated Deletion (Cloud Function)

For a fully automated solution, you can deploy a Firebase Cloud Function.

### Prerequisites:
- Node.js installed on your computer
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase project with Blaze plan (pay-as-you-go, free tier available)

### Setup Instructions:

#### 1. Initialize Firebase Functions
```bash
cd c:\Users\SRUSHTI\Downloads\finalsayhadri
firebase login
firebase init functions
```

Select:
- Use existing project: **sayhadrid**
- Language: **JavaScript**
- ESLint: **No** (or Yes if you prefer)
- Install dependencies: **Yes**

#### 2. Create the Cloud Function

Create/edit `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Cloud Function to delete Firebase Auth user when employee is deleted
exports.deleteAuthUser = functions.database
  .ref('/employees/{employeeId}')
  .onUpdate(async (change, context) => {
    const before = change.before.val();
    const after = change.after.val();
    
    // Check if employee was just marked as deleted
    if (!before.deleted && after.deleted && after.firebaseUid) {
      try {
        // Delete the Firebase Auth user
        await admin.auth().deleteUser(after.firebaseUid);
        
        console.log(`✅ Deleted Firebase Auth user: ${after.email} (${after.firebaseUid})`);
        
        // Remove from deletedAuthAccounts since it's now deleted
        await admin.database()
          .ref(`/deletedAuthAccounts/${after.firebaseUid}`)
          .remove();
        
        // Log successful deletion
        await admin.database()
          .ref(`/authDeletionLogs/${after.firebaseUid}`)
          .set({
            email: after.email,
            employeeName: after.employeeName,
            deletedAt: admin.database.ServerValue.TIMESTAMP,
            deletedBy: after.deletedBy || 'System',
            status: 'success'
          });
        
        return null;
      } catch (error) {
        console.error(`❌ Error deleting Firebase Auth user ${after.email}:`, error);
        
        // Log failed deletion
        await admin.database()
          .ref(`/authDeletionLogs/${after.firebaseUid}`)
          .set({
            email: after.email,
            employeeName: after.employeeName,
            attemptedAt: admin.database.ServerValue.TIMESTAMP,
            deletedBy: after.deletedBy || 'System',
            status: 'failed',
            error: error.message
          });
        
        throw error;
      }
    }
    
    return null;
  });

// Alternative: HTTP Callable Function (can be called directly from client)
exports.deleteEmployeeAuth = functions.https.onCall(async (data, context) => {
  // Verify caller is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be logged in to delete employees'
    );
  }
  
  // You can add additional admin check here
  const callerEmail = context.auth.token.email;
  const adminEmails = [
    'superadmin@gmail.com',
    'productionincharge@gmail.com',
    'proin@gmail.com'
  ];
  
  if (!adminEmails.includes(callerEmail)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can delete employees'
    );
  }
  
  const { firebaseUid, email } = data;
  
  if (!firebaseUid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Firebase UID is required'
    );
  }
  
  try {
    await admin.auth().deleteUser(firebaseUid);
    
    console.log(`✅ Deleted Firebase Auth user: ${email} (${firebaseUid})`);
    
    // Remove from deletedAuthAccounts
    await admin.database()
      .ref(`/deletedAuthAccounts/${firebaseUid}`)
      .remove();
    
    return {
      success: true,
      message: `Firebase Auth account deleted for ${email}`
    };
  } catch (error) {
    console.error(`❌ Error deleting user:`, error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to delete user: ${error.message}`
    );
  }
});
```

#### 3. Deploy the Function
```bash
firebase deploy --only functions
```

#### 4. Update Client Code (Optional - for HTTP Callable)

If you want to use the HTTP callable function, update your delete handlers:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const deleteEmployeeAuth = httpsCallable(functions, 'deleteEmployeeAuth');

// In handleDeleteEmployee:
if (employee.firebaseUid) {
  try {
    const result = await deleteEmployeeAuth({
      firebaseUid: employee.firebaseUid,
      email: employee.email
    });
    console.log(result.data.message);
    showToast('✅ Employee and Firebase Auth account deleted!', 'success');
  } catch (error) {
    console.error('Error deleting auth account:', error);
    showToast('⚠️ Employee deleted but Firebase Auth deletion failed. Please delete manually.', 'warning');
  }
}
```

---

## Comparison: Manual vs Automated

| Feature | Manual Deletion | Cloud Function (Automated) |
|---------|----------------|---------------------------|
| **Setup Time** | None | 30-60 minutes |
| **Cost** | Free | Free tier available |
| **Deletion Speed** | 1-2 minutes per employee | Instant (automatic) |
| **Reliability** | Depends on admin | 100% automated |
| **Tracking** | Via deletedAuthAccounts | Automatic logs |
| **Best For** | Small teams, occasional deletions | Large teams, frequent deletions |

---

## Troubleshooting

### Issue: Can't find user in Firebase Console
**Solution**: 
- Check the UID carefully (copy from console log)
- User might already be deleted
- Check `/deletedAuthAccounts` in database to see if it's tracked

### Issue: "User not found" error when deleting
**Solution**:
- User was already deleted from Firebase Auth
- Remove the entry from `/deletedAuthAccounts` manually

### Issue: Cloud Function not deploying
**Solution**:
- Ensure Firebase project is on Blaze plan
- Run `firebase login` to authenticate
- Check `functions/package.json` has correct dependencies

### Issue: Cloud Function deployed but not working
**Solution**:
- Check Firebase Console → Functions → Logs
- Verify the function is triggered
- Check for errors in the logs

---

## Best Practices

1. **Always check console logs** after deleting an employee - it has the UID for easy reference

2. **Keep track of deletions** - Review `/deletedAuthAccounts` weekly to ensure all accounts are cleaned up

3. **Document the process** - Train all admins on the manual deletion process

4. **Consider Cloud Functions** - If you delete employees frequently, the automated approach saves time

5. **Verify deletion** - After deleting from Firebase Auth, try logging in with those credentials to confirm

---

## Security Notes

- **Why we can't delete from client**: Firebase prevents client-side user deletion to protect against malicious attacks
- **Cloud Functions are secure**: They run on Google's servers with admin privileges
- **Manual deletion is safe**: Only authenticated admins can access Firebase Console
- **Tracking helps audit**: The `deletedAuthAccounts` node provides an audit trail

---

## Quick Reference

### Manual Deletion Checklist:
- [ ] Delete employee in app
- [ ] Note email and UID from warning/console
- [ ] Open Firebase Console → Authentication
- [ ] Search for user by email or UID
- [ ] Delete the account
- [ ] Verify user can't login anymore
- [ ] (Optional) Remove from `/deletedAuthAccounts` in database

### Cloud Function Checklist:
- [ ] Install Firebase CLI
- [ ] Initialize functions in project
- [ ] Copy function code to `functions/index.js`
- [ ] Deploy with `firebase deploy --only functions`
- [ ] Test by deleting an employee
- [ ] Verify automatic deletion in Firebase Console
