package com.rt2zz.reactnativecontacts;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.support.annotation.NonNull;
import android.text.TextUtils;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import static android.provider.ContactsContract.CommonDataKinds.Contactables;
import static android.provider.ContactsContract.CommonDataKinds.Email;
import static android.provider.ContactsContract.CommonDataKinds.Organization;
import static android.provider.ContactsContract.CommonDataKinds.Phone;
import static android.provider.ContactsContract.CommonDataKinds.StructuredName;
import static android.provider.ContactsContract.CommonDataKinds.StructuredPostal;

public class ContactsProvider {
    public static final int ID_FOR_PROFILE_CONTACT = -1;

    private static final List<String> JUST_ME_PROJECTION = new ArrayList<String>() {{
        add(ContactsContract.Data.CONTACT_ID);
        add(ContactsContract.Data.LOOKUP_KEY);
        add(ContactsContract.Contacts.Data.MIMETYPE);
        add(ContactsContract.Profile.DISPLAY_NAME);
        add(Contactables.PHOTO_URI);
        add(StructuredName.DISPLAY_NAME);
        add(StructuredName.GIVEN_NAME);
        add(StructuredName.MIDDLE_NAME);
        add(StructuredName.FAMILY_NAME);
        add(StructuredName.PREFIX);
        add(StructuredName.SUFFIX);
        add(Phone.NUMBER);
        add(Phone.TYPE);
        add(Phone.LABEL);
        add(Email.DATA);
        add(Email.ADDRESS);
        add(Email.TYPE);
        add(Email.LABEL);
        add(Organization.COMPANY);
        add(Organization.TITLE);
        add(Organization.DEPARTMENT);
        add(StructuredPostal.FORMATTED_ADDRESS);
        add(StructuredPostal.TYPE);
        add(StructuredPostal.LABEL);
        add(StructuredPostal.STREET);
        add(StructuredPostal.POBOX);
        add(StructuredPostal.NEIGHBORHOOD);
        add(StructuredPostal.CITY);
        add(StructuredPostal.REGION);
        add(StructuredPostal.POSTCODE);
        add(StructuredPostal.COUNTRY);
    }};

    private static final List<String> FULL_PROJECTION = new ArrayList<String>() {{
        addAll(JUST_ME_PROJECTION);
    }};

    private static final List<String> PHOTO_PROJECTION = new ArrayList<String>() {{
        add(Contactables.PHOTO_URI);
    }};

    private final ContentResolver contentResolver;

    public ContactsProvider(ContentResolver contentResolver) {
        this.contentResolver = contentResolver;
    }

    public WritableArray getContactsMatchingString(String searchString) {
        Map<String, Contact> matchingContacts;
        {
            Cursor cursor = contentResolver.query(
                    ContactsContract.Data.CONTENT_URI,
                    FULL_PROJECTION.toArray(new String[FULL_PROJECTION.size()]),
                    ContactsContract.Contacts.DISPLAY_NAME_PRIMARY + " LIKE ?",
                    new String[]{"%" + searchString + "%"},
                    null
            );

            try {
                matchingContacts = loadContactsFrom(cursor);
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        }

        WritableArray contacts = Arguments.createArray();
        for (Contact contact : matchingContacts.values()) {
            contacts.pushMap(contact.toMap());
        }
        return contacts;
    }

    public WritableArray getContacts() {
        Map<String, Contact> justMe;
        {
            Cursor cursor = contentResolver.query(
                    Uri.withAppendedPath(ContactsContract.Profile.CONTENT_URI, ContactsContract.Contacts.Data.CONTENT_DIRECTORY),
                    JUST_ME_PROJECTION.toArray(new String[JUST_ME_PROJECTION.size()]),
                    null,
                    null,
                    null
            );

            try {
                justMe = loadContactsFrom(cursor);
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        }

        Map<String, Contact> everyoneElse;
        {
            Cursor cursor = contentResolver.query(
                    ContactsContract.Data.CONTENT_URI,
                    FULL_PROJECTION.toArray(new String[FULL_PROJECTION.size()]),
                    ContactsContract.Data.MIMETYPE + "=? OR " + ContactsContract.Data.MIMETYPE + "=? OR " + ContactsContract.Data.MIMETYPE + "=? OR " + ContactsContract.Data.MIMETYPE + "=? OR " + ContactsContract.Data.MIMETYPE + "=?",
                    new String[]{Email.CONTENT_ITEM_TYPE, Phone.CONTENT_ITEM_TYPE, StructuredName.CONTENT_ITEM_TYPE, Organization.CONTENT_ITEM_TYPE, StructuredPostal.CONTENT_ITEM_TYPE},
                    null
            );

            try {
                everyoneElse = loadContactsFrom(cursor);
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        }

        WritableArray contacts = Arguments.createArray();
        for (Contact contact : justMe.values()) {
            contacts.pushMap(contact.toMap());
        }
        for (Contact contact : everyoneElse.values()) {
            contacts.pushMap(contact.toMap());
        }

        return contacts;
    }

    @NonNull
    private Map<String, Contact> loadContactsFrom(Cursor cursor) {

        Map<String, Contact> map = new LinkedHashMap<>();

        while (cursor != null && cursor.moveToNext()) {

            int columnIndex = cursor.getColumnIndex(ContactsContract.Data.CONTACT_ID);
            String contactId;
            if (columnIndex != -1) {
                contactId = cursor.getString(columnIndex);
            } else {
                //todo - double check this, it may not be necessary any more
                contactId = String.valueOf(ID_FOR_PROFILE_CONTACT);//no contact id for 'ME' user
            }

            if (!map.containsKey(contactId)) {
                map.put(contactId, new Contact(contactId));
            }

            Contact contact = map.get(contactId);

            String mimeType = cursor.getString(cursor.getColumnIndex(ContactsContract.Data.MIMETYPE));

            String name = cursor.getString(cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME));
            if (!TextUtils.isEmpty(name) && TextUtils.isEmpty(contact.displayName)) {
                contact.displayName = name;
            }

            if(TextUtils.isEmpty(contact.photoUri)) {
                String rawPhotoURI = cursor.getString(cursor.getColumnIndex(Contactables.PHOTO_URI));
                if (!TextUtils.isEmpty(rawPhotoURI)) {
                    contact.photoUri = rawPhotoURI;
                    contact.hasPhoto = true;
                }
            }

            if (mimeType.equals(StructuredName.CONTENT_ITEM_TYPE)) {
                contact.givenName = cursor.getString(cursor.getColumnIndex(StructuredName.GIVEN_NAME));
                contact.middleName = cursor.getString(cursor.getColumnIndex(StructuredName.MIDDLE_NAME));
                contact.familyName = cursor.getString(cursor.getColumnIndex(StructuredName.FAMILY_NAME));
                contact.prefix = cursor.getString(cursor.getColumnIndex(StructuredName.PREFIX));
                contact.suffix = cursor.getString(cursor.getColumnIndex(StructuredName.SUFFIX));
            } else if (mimeType.equals(Phone.CONTENT_ITEM_TYPE)) {
                String phoneNumber = cursor.getString(cursor.getColumnIndex(Phone.NUMBER));
                int type = cursor.getInt(cursor.getColumnIndex(Phone.TYPE));

                if (!TextUtils.isEmpty(phoneNumber)) {
                    String label;
                    switch (type) {
                        case Phone.TYPE_HOME:
                            label = "home";
                            break;
                        case Phone.TYPE_WORK:
                            label = "work";
                            break;
                        case Phone.TYPE_MOBILE:
                            label = "mobile";
                            break;
                        default:
                            label = "other";
                    }
                    contact.phones.add(new Contact.Item(label, phoneNumber));
                }
            } else if (mimeType.equals(Email.CONTENT_ITEM_TYPE)) {
                String email = cursor.getString(cursor.getColumnIndex(Email.ADDRESS));
                int type = cursor.getInt(cursor.getColumnIndex(Email.TYPE));

                if (!TextUtils.isEmpty(email)) {
                    String label;
                    switch (type) {
                        case Email.TYPE_HOME:
                            label = "home";
                            break;
                        case Email.TYPE_WORK:
                            label = "work";
                            break;
                        case Email.TYPE_MOBILE:
                            label = "mobile";
                            break;
                        case Email.TYPE_CUSTOM:
                            if (cursor.getString(cursor.getColumnIndex(Email.LABEL)) != null) {
                                label = cursor.getString(cursor.getColumnIndex(Email.LABEL)).toLowerCase();
                            } else {
                                label = "";
                            }
                            break;
                        default:
                            label = "other";
                    }
                    contact.emails.add(new Contact.Item(label, email));
                }
            } else if (mimeType.equals(Organization.CONTENT_ITEM_TYPE)) {
                contact.company = cursor.getString(cursor.getColumnIndex(Organization.COMPANY));
                contact.jobTitle = cursor.getString(cursor.getColumnIndex(Organization.TITLE));
                contact.department = cursor.getString(cursor.getColumnIndex(Organization.DEPARTMENT));
            } else if (mimeType.equals(StructuredPostal.CONTENT_ITEM_TYPE)) {
                contact.postalAddresses.add(new Contact.PostalAddressItem(cursor));
            }
        }

        return map;
    }

    public String getPhotoUriFromContactId(String contactId) {
        Cursor cursor = contentResolver.query(
                ContactsContract.Data.CONTENT_URI,
                PHOTO_PROJECTION.toArray(new String[PHOTO_PROJECTION.size()]),
                ContactsContract.RawContacts.CONTACT_ID + " = ?",
                new String[]{contactId},
                null
        );
        try {
            if (cursor != null && cursor.moveToNext()) {
                String rawPhotoURI = cursor.getString(cursor.getColumnIndex(Contactables.PHOTO_URI));
                if (!TextUtils.isEmpty(rawPhotoURI)) {
                    return rawPhotoURI;
                }
            }
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        return null;
    }

    private static class Contact {
        private String contactId;
        private String displayName;
        private String givenName = "";
        private String middleName = "";
        private String familyName = "";
        private String prefix = "";
        private String suffix = "";
        private String company = "";
        private String jobTitle ="";
        private String department ="";
        private boolean hasPhoto = false;
        private String photoUri;
        private List<Item> emails = new ArrayList<>();
        private List<Item> phones = new ArrayList<>();
        private List<PostalAddressItem> postalAddresses = new ArrayList<>();

        public Contact(String contactId) {
            this.contactId = contactId;
        }

        public WritableMap toMap() {
            WritableMap contact = Arguments.createMap();
            contact.putString("recordID", contactId);
            contact.putString("givenName", TextUtils.isEmpty(givenName) ? displayName : givenName);
            contact.putString("middleName", middleName);
            contact.putString("familyName", familyName);
            contact.putString("prefix", prefix);
            contact.putString("suffix", suffix);
            contact.putString("company", company);
            contact.putString("jobTitle", jobTitle);
            contact.putString("department", department);
            contact.putBoolean("hasThumbnail", this.hasPhoto);
            contact.putString("thumbnailPath", photoUri == null ? "" : photoUri);

            WritableArray phoneNumbers = Arguments.createArray();
            for (Item item : phones) {
                WritableMap map = Arguments.createMap();
                map.putString("number", item.value);
                map.putString("label", item.label);
                phoneNumbers.pushMap(map);
            }
            contact.putArray("phoneNumbers", phoneNumbers);

            WritableArray emailAddresses = Arguments.createArray();
            for (Item item : emails) {
                WritableMap map = Arguments.createMap();
                map.putString("email", item.value);
                map.putString("label", item.label);
                emailAddresses.pushMap(map);
            }
            contact.putArray("emailAddresses", emailAddresses);

            WritableArray postalAddresses = Arguments.createArray();
            for (PostalAddressItem item : this.postalAddresses) {
              postalAddresses.pushMap(item.map);
            }
            contact.putArray("postalAddresses", postalAddresses);

            return contact;
        }

        public static class Item {
            public String label;
            public String value;

            public Item(String label, String value) {
                this.label = label;
                this.value = value;
            }
        }

        public static class PostalAddressItem {
            public final WritableMap map;

            public PostalAddressItem(Cursor cursor) {
                map = Arguments.createMap();

                map.putString("label", getLabel(cursor));
                putString(cursor, "formattedAddress", StructuredPostal.FORMATTED_ADDRESS);
                putString(cursor, "street", StructuredPostal.STREET);
                putString(cursor, "pobox", StructuredPostal.POBOX);
                putString(cursor, "neighborhood", StructuredPostal.NEIGHBORHOOD);
                putString(cursor, "city", StructuredPostal.CITY);
                putString(cursor, "region", StructuredPostal.REGION);
                putString(cursor, "state", StructuredPostal.REGION);
                putString(cursor, "postCode", StructuredPostal.POSTCODE);
                putString(cursor, "country", StructuredPostal.COUNTRY);
            }

            private void putString(Cursor cursor, String key, String androidKey) {
                final String value = cursor.getString(cursor.getColumnIndex(androidKey));
                if (!TextUtils.isEmpty(value))
                  map.putString(key, value);
            }

            static String getLabel(Cursor cursor) {
                switch (cursor.getInt(cursor.getColumnIndex(StructuredPostal.TYPE))) {
                    case StructuredPostal.TYPE_HOME:
                        return "home";
                    case StructuredPostal.TYPE_WORK:
                        return "work";
                    case StructuredPostal.TYPE_CUSTOM:
                        final String label = cursor.getString(cursor.getColumnIndex(StructuredPostal.LABEL));
                        return label != null ? label : "";
                }
                return "other";
            }
        }
    }
}
