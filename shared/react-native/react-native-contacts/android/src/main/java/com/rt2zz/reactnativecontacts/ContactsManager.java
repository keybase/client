package com.rt2zz.reactnativecontacts;

import android.Manifest;
import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.AsyncTask;
import android.provider.ContactsContract;
import android.provider.ContactsContract.CommonDataKinds;
import android.provider.ContactsContract.CommonDataKinds.Organization;
import android.provider.ContactsContract.CommonDataKinds.StructuredName;
import android.provider.ContactsContract.RawContacts;
import android.support.annotation.NonNull;

import com.facebook.react.ReactActivity;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.modules.core.PermissionListener;

import java.util.ArrayList;

public class ContactsManager extends ReactContextBaseJavaModule {

    private Callback callback;

    public ContactsManager(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    /*
     * Returns all contactable records on phone
     * queries CommonDataKinds.Contactables to get phones and emails
     */
    @ReactMethod
    public void getAll(final Callback callback) {
        getAllContacts(callback);
    }

    /**
     * Introduced for iOS compatibility.  Same as getAll
     *
     * @param callback callback
     */
    @ReactMethod
    public void getAllWithoutPhotos(final Callback callback) {
        getAllContacts(callback);
    }

    /**
     * Retrieves contacts.
     * Uses raw URI when <code>rawUri</code> is <code>true</code>, makes assets copy otherwise.
     * @param callback user provided callback to run at completion
     */
    private void getAllContacts(final Callback callback) {
        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                Context context = getReactApplicationContext();
                ContentResolver cr = context.getContentResolver();

                ContactsProvider contactsProvider = new ContactsProvider(cr);
                WritableArray contacts = contactsProvider.getContacts();

                callback.invoke(null, contacts);
            }
        });
    }

    /*
     * Returns all contacts matching string
     */
    @ReactMethod
    public void getContactsMatchingString(final String searchString, final Callback callback) {
        getAllContactsMatchingString(searchString, callback);
    }
    /**
     * Retrieves contacts matching String.
     * Uses raw URI when <code>rawUri</code> is <code>true</code>, makes assets copy otherwise.
     * @param searchString String to match
     * @param callback user provided callback to run at completion
     */
    private void getAllContactsMatchingString(final String searchString, final Callback callback) {
        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                Context context = getReactApplicationContext();
                ContentResolver cr = context.getContentResolver();
                ContactsProvider contactsProvider = new ContactsProvider(cr);
                WritableArray contacts = contactsProvider.getContactsMatchingString(searchString);

                callback.invoke(null, contacts);
            }
        });
    }

    /**
     * Retrieves <code>thumbnailPath</code> for contact, or <code>null</code> if not available.
     * @param contactId contact identifier, <code>recordID</code>
     * @param callback callback
     */
    @ReactMethod
    public void getPhotoForId(final String contactId, final Callback callback) {
        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                Context context = getReactApplicationContext();
                ContentResolver cr = context.getContentResolver();
                ContactsProvider contactsProvider = new ContactsProvider(cr);
                String photoUri = contactsProvider.getPhotoUriFromContactId(contactId);

                callback.invoke(null, photoUri);
            }
        });
    }

    /*
     * Adds contact to phone's addressbook
     */
    @ReactMethod
    public void addContact(ReadableMap contact, Callback callback) {

        String givenName = contact.hasKey("givenName") ? contact.getString("givenName") : null;
        String middleName = contact.hasKey("middleName") ? contact.getString("middleName") : null;
        String familyName = contact.hasKey("familyName") ? contact.getString("familyName") : null;
        String prefix = contact.hasKey("prefix") ? contact.getString("prefix") : null;
        String suffix = contact.hasKey("suffix") ? contact.getString("suffix") : null;
        String company = contact.hasKey("company") ? contact.getString("company") : null;
        String jobTitle = contact.hasKey("jobTitle") ? contact.getString("jobTitle") : null;
        String department = contact.hasKey("department") ? contact.getString("department") : null;

        // String name = givenName;
        // name += middleName != "" ? " " + middleName : "";
        // name += familyName != "" ? " " + familyName : "";

        ReadableArray phoneNumbers = contact.hasKey("phoneNumbers") ? contact.getArray("phoneNumbers") : null;
        int numOfPhones = 0;
        String[] phones = null;
        Integer[] phonesLabels = null;
        if (phoneNumbers != null) {
            numOfPhones = phoneNumbers.size();
            phones = new String[numOfPhones];
            phonesLabels = new Integer[numOfPhones];
            for (int i = 0; i < numOfPhones; i++) {
                phones[i] = phoneNumbers.getMap(i).getString("number");
                String label = phoneNumbers.getMap(i).getString("label");
                phonesLabels[i] = mapStringToPhoneType(label);
            }
        }

        ReadableArray emailAddresses = contact.hasKey("emailAddresses") ? contact.getArray("emailAddresses") : null;
        int numOfEmails = 0;
        String[] emails = null;
        Integer[] emailsLabels = null;
        if (emailAddresses != null) {
            numOfEmails = emailAddresses.size();
            emails = new String[numOfEmails];
            emailsLabels = new Integer[numOfEmails];
            for (int i = 0; i < numOfEmails; i++) {
                emails[i] = emailAddresses.getMap(i).getString("email");
                String label = emailAddresses.getMap(i).getString("label");
                emailsLabels[i] = mapStringToEmailType(label);
            }
        }

        ArrayList<ContentProviderOperation> ops = new ArrayList<ContentProviderOperation>();

        ContentProviderOperation.Builder op = ContentProviderOperation.newInsert(RawContacts.CONTENT_URI)
                .withValue(RawContacts.ACCOUNT_TYPE, null)
                .withValue(RawContacts.ACCOUNT_NAME, null);
        ops.add(op.build());

        op = ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, StructuredName.CONTENT_ITEM_TYPE)
                // .withValue(StructuredName.DISPLAY_NAME, name)
                .withValue(StructuredName.GIVEN_NAME, givenName)
                .withValue(StructuredName.MIDDLE_NAME, middleName)
                .withValue(StructuredName.FAMILY_NAME, familyName)
                .withValue(StructuredName.PREFIX, prefix)
                .withValue(StructuredName.SUFFIX, suffix);
        ops.add(op.build());

        op = ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, Organization.CONTENT_ITEM_TYPE)
                .withValue(Organization.COMPANY, company)
                .withValue(Organization.TITLE, jobTitle)
                .withValue(Organization.DEPARTMENT, department);
        ops.add(op.build());

        //TODO not sure where to allow yields
        op.withYieldAllowed(true);

        for (int i = 0; i < numOfPhones; i++) {
            op = ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                    .withValue(CommonDataKinds.Phone.NUMBER, phones[i])
                    .withValue(CommonDataKinds.Phone.TYPE, phonesLabels[i]);
            ops.add(op.build());
        }

        for (int i = 0; i < numOfEmails; i++) {
            op = ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, CommonDataKinds.Email.CONTENT_ITEM_TYPE)
                    .withValue(CommonDataKinds.Email.ADDRESS, emails[i])
                    .withValue(CommonDataKinds.Email.TYPE, emailsLabels[i]);
            ops.add(op.build());
        }

        ReadableArray postalAddresses = contact.hasKey("postalAddresses") ? contact.getArray("postalAddresses") : null;
        if (postalAddresses != null) {
            for (int i = 0; i <  postalAddresses.size() ; i++) {
                ReadableMap address = postalAddresses.getMap(i);

                op = ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                        .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                        .withValue(ContactsContract.Data.MIMETYPE, CommonDataKinds.StructuredPostal.CONTENT_ITEM_TYPE)
                        .withValue(CommonDataKinds.StructuredPostal.TYPE, mapStringToPostalAddressType(address.getString("label")))
                        .withValue(CommonDataKinds.StructuredPostal.STREET, address.getString("street"))
                        .withValue(CommonDataKinds.StructuredPostal.CITY, address.getString("city"))
                        .withValue(CommonDataKinds.StructuredPostal.REGION, address.getString("state"))
                        .withValue(CommonDataKinds.StructuredPostal.POSTCODE, address.getString("postCode"))
                        .withValue(CommonDataKinds.StructuredPostal.COUNTRY, address.getString("country"));

                ops.add(op.build());
            }
        }

        Context ctx = getReactApplicationContext();
        try {
            ContentResolver cr = ctx.getContentResolver();
            cr.applyBatch(ContactsContract.AUTHORITY, ops);
            callback.invoke(); // success
        } catch (Exception e) {
            callback.invoke(e.toString());
        }
    }

    /*
     * Update contact to phone's addressbook
     */
    @ReactMethod
    public void updateContact(ReadableMap contact, Callback callback) {

        String recordID = contact.hasKey("recordID") ? contact.getString("recordID") : null;

        String givenName = contact.hasKey("givenName") ? contact.getString("givenName") : null;
        String middleName = contact.hasKey("middleName") ? contact.getString("middleName") : null;
        String familyName = contact.hasKey("familyName") ? contact.getString("familyName") : null;
        String prefix = contact.hasKey("prefix") ? contact.getString("prefix") : null;
        String suffix = contact.hasKey("suffix") ? contact.getString("suffix") : null;
        String company = contact.hasKey("company") ? contact.getString("company") : null;
        String jobTitle = contact.hasKey("jobTitle") ? contact.getString("jobTitle") : null;
        String department = contact.hasKey("department") ? contact.getString("department") : null;

        ReadableArray phoneNumbers = contact.hasKey("phoneNumbers") ? contact.getArray("phoneNumbers") : null;
        int numOfPhones = 0;
        String[] phones = null;
        Integer[] phonesLabels = null;
        if (phoneNumbers != null) {
            numOfPhones = phoneNumbers.size();
            phones = new String[numOfPhones];
            phonesLabels = new Integer[numOfPhones];
            for (int i = 0; i < numOfPhones; i++) {
                ReadableMap phoneMap = phoneNumbers.getMap(i);
                String phoneNumber = phoneMap.getString("number");
                String phoneLabel = phoneMap.getString("label");
                phones[i] = phoneNumber;
                phonesLabels[i] = mapStringToPhoneType(phoneLabel);
            }
        }

        ReadableArray emailAddresses = contact.hasKey("emailAddresses") ? contact.getArray("emailAddresses") : null;
        int numOfEmails = 0;
        String[] emails = null;
        Integer[] emailsLabels = null;
        if (emailAddresses != null) {
            numOfEmails = emailAddresses.size();
            emails = new String[numOfEmails];
            emailsLabels = new Integer[numOfEmails];
            for (int i = 0; i < numOfEmails; i++) {
                ReadableMap emailMap = emailAddresses.getMap(i);
                emails[i] = emailMap.getString("email");
                String label = emailMap.getString("label");
                emailsLabels[i] = mapStringToEmailType(label);
            }
        }

        ArrayList<ContentProviderOperation> ops = new ArrayList<ContentProviderOperation>();

        ContentProviderOperation.Builder op = ContentProviderOperation.newUpdate(RawContacts.CONTENT_URI)
                .withSelection(ContactsContract.Data.CONTACT_ID + "=?", new String[]{String.valueOf(recordID)})
                .withValue(RawContacts.ACCOUNT_TYPE, null)
                .withValue(RawContacts.ACCOUNT_NAME, null);
        ops.add(op.build());

        op = ContentProviderOperation.newUpdate(ContactsContract.Data.CONTENT_URI)
                .withSelection(ContactsContract.Data.CONTACT_ID + "=?", new String[]{String.valueOf(recordID)})
                .withValue(ContactsContract.Data.MIMETYPE, StructuredName.CONTENT_ITEM_TYPE)
                .withValue(StructuredName.GIVEN_NAME, givenName)
                .withValue(StructuredName.MIDDLE_NAME, middleName)
                .withValue(StructuredName.FAMILY_NAME, familyName)
                .withValue(StructuredName.PREFIX, prefix)
                .withValue(StructuredName.SUFFIX, suffix);
        ops.add(op.build());

        op = ContentProviderOperation.newUpdate(ContactsContract.Data.CONTENT_URI)
                .withSelection(ContactsContract.Data.CONTACT_ID + "=? AND " + ContactsContract.Data.MIMETYPE + " = ?", new String[]{String.valueOf(recordID), Organization.CONTENT_ITEM_TYPE})
                .withValue(Organization.COMPANY, company)
                .withValue(Organization.TITLE, jobTitle)
                .withValue(Organization.DEPARTMENT, department);
        ops.add(op.build());

        op.withYieldAllowed(true);

        for (int i = 0; i < numOfPhones; i++) {
            op = ContentProviderOperation.newUpdate(ContactsContract.Data.CONTENT_URI)
                    .withSelection(ContactsContract.Data.CONTACT_ID + "=? AND " + ContactsContract.Data.MIMETYPE + " = ?", new String[]{String.valueOf(recordID), CommonDataKinds.Phone.CONTENT_ITEM_TYPE})
                    .withValue(ContactsContract.Data.MIMETYPE, CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                    .withValue(CommonDataKinds.Phone.NUMBER, phones[i])
                    .withValue(CommonDataKinds.Phone.TYPE, phonesLabels[i]);
            ops.add(op.build());
        }

        for (int i = 0; i < numOfEmails; i++) {
            op = ContentProviderOperation.newUpdate(ContactsContract.Data.CONTENT_URI)
                    .withSelection(ContactsContract.Data.RAW_CONTACT_ID + "=? AND " + ContactsContract.Data.MIMETYPE + " = ?", new String[]{String.valueOf(recordID), CommonDataKinds.Email.CONTENT_ITEM_TYPE})
                    .withValue(ContactsContract.Data.MIMETYPE, CommonDataKinds.Email.CONTENT_ITEM_TYPE)
                    .withValue(CommonDataKinds.Email.ADDRESS, emails[i])
                    .withValue(CommonDataKinds.Email.TYPE, emailsLabels[i]);
            ops.add(op.build());
        }

        Context ctx = getReactApplicationContext();
        try {
            ContentResolver cr = ctx.getContentResolver();
            cr.applyBatch(ContactsContract.AUTHORITY, ops);
            callback.invoke(); // success
        } catch (Exception e) {
            callback.invoke(e.toString());
        }
    }

    /*
     * Check permission
     */
    @ReactMethod
    public void checkPermission(Callback callback) {
        callback.invoke(null, isPermissionGranted());
    }

    /*
     * Request permission
     */
    @ReactMethod
    public void requestPermission(Callback callback) {
        if (isPermissionGranted().equals("authorized")) {
            callback.invoke(null, true);
            return;
        }
        String[] PERMISSIONS = {Manifest.permission.READ_CONTACTS};
        if (this.getCurrentActivity() != null) {
            this.callback = callback;
            ((ReactActivity) this.getCurrentActivity()).requestPermissions(PERMISSIONS, 1, listener);
        }
    }

    private PermissionListener listener = new PermissionListener()
    {
        public boolean onRequestPermissionsResult(final int requestCode,
                                                  @NonNull final String[] permissions,
                                                  @NonNull final int[] grantResults)
        {
            boolean permissionsGranted = true;
            for (int i = 0; i < permissions.length; i++) {
                final boolean granted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
                permissionsGranted = permissionsGranted && granted;
            }

            if (callback == null) {
                return false;
            }

            callback.invoke(null, true);

            return permissionsGranted;
        }
    };

    /*
     * Check if READ_CONTACTS permission is granted
     */
    private String isPermissionGranted() {
        String permission = "android.permission.READ_CONTACTS";
        // return -1 for denied and 1
        int res = getReactApplicationContext().checkCallingOrSelfPermission(permission);
        return (res == PackageManager.PERMISSION_GRANTED) ? "authorized" : "denied";
    }

    /*
     * TODO support all phone types
     * http://developer.android.com/reference/android/provider/ContactsContract.CommonDataKinds.Phone.html
     */
    private int mapStringToPhoneType(String label) {
        int phoneType;
        switch (label) {
            case "home":
                phoneType = CommonDataKinds.Phone.TYPE_HOME;
                break;
            case "work":
                phoneType = CommonDataKinds.Phone.TYPE_WORK;
                break;
            case "mobile":
                phoneType = CommonDataKinds.Phone.TYPE_MOBILE;
                break;
            default:
                phoneType = CommonDataKinds.Phone.TYPE_OTHER;
                break;
        }
        return phoneType;
    }

    /*
     * TODO support TYPE_CUSTOM
     * http://developer.android.com/reference/android/provider/ContactsContract.CommonDataKinds.Email.html
     */
    private int mapStringToEmailType(String label) {
        int emailType;
        switch (label) {
            case "home":
                emailType = CommonDataKinds.Email.TYPE_HOME;
                break;
            case "work":
                emailType = CommonDataKinds.Email.TYPE_WORK;
                break;
            case "mobile":
                emailType = CommonDataKinds.Email.TYPE_MOBILE;
                break;
            default:
                emailType = CommonDataKinds.Email.TYPE_OTHER;
                break;
        }
        return emailType;
    }

    private int mapStringToPostalAddressType(String label) {
        int postalAddressType;
        switch (label) {
            case "home":
                postalAddressType = CommonDataKinds.StructuredPostal.TYPE_HOME;
                break;
            case "work":
                postalAddressType = CommonDataKinds.StructuredPostal.TYPE_WORK;
                break;
            default:
                postalAddressType = CommonDataKinds.StructuredPostal.TYPE_OTHER;
                break;
        }
        return postalAddressType;
    }

    @Override
    public String getName() {
        return "Contacts";
    }
}
