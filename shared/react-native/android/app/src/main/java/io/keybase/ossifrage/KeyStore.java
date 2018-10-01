package io.keybase.ossifrage;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.util.Base64;

import org.msgpack.MessagePack;

import java.io.IOException;
import java.security.InvalidKeyException;
import java.security.KeyPair;
import java.security.KeyStore.Entry;
import java.security.KeyStore.PrivateKeyEntry;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.cert.CertificateException;
import java.util.ArrayList;
import java.util.Iterator;

import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import keybase.UnsafeExternalKeyStore;
import io.keybase.ossifrage.keystore.KeyStoreHelper;
import io.keybase.ossifrage.modules.NativeLogger;

public class KeyStore implements UnsafeExternalKeyStore {
    private final Context context;
    private final SharedPreferences prefs;
    private java.security.KeyStore ks;

    // Prefix for the key we use when we place the data in shared preferences
    private static final String PREFS_KEY = "_wrappedKey_";
    // The name of the key we use to store our created RSA keypair in android's keystore
    private static final String KEY_ALIAS = "_keybase-rsa-wrapper_";

    private static final String ALGORITHM = "RSA_SECRETBOX";

    public KeyStore(final Context context, final SharedPreferences prefs) throws KeyStoreException, CertificateException, NoSuchAlgorithmException, IOException {
        this.context = context;
        this.prefs = prefs;

        ks = java.security.KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        NativeLogger.info("KeyStore: initialized");
    }

    private String sharedPrefKeyPrefix(final String serviceName) {
        return serviceName + PREFS_KEY;
    }

    private String keyStoreAlias(final String serviceName) {
        return serviceName + KEY_ALIAS;
    }

    @SuppressLint("CommitPrefEdits")
    @Override
    public void clearSecret(final String serviceName, final String key) throws Exception {
        String id = serviceName + ":" + key;
        NativeLogger.info("KeyStore: clearing secret for " + id);

        try {
            prefs.edit().remove(sharedPrefKeyPrefix(serviceName) + key).commit();
        } catch (Exception e) {
            NativeLogger.error("KeyStore: error clearing secret for " + id, e);
            throw e;
        }

        NativeLogger.info("KeyStore: cleared secret for " + id);
    }

    @Override
    public synchronized byte[] getUsersWithStoredSecretsMsgPack(final String serviceName) throws Exception {
        NativeLogger.info("KeyStore: getting users with stored secrets for " + serviceName);

        try {
            final Iterator<String> keyIterator = prefs.getAll().keySet().iterator();
            final ArrayList<String> userNames = new ArrayList<>();

            while (keyIterator.hasNext()) {
                final String key = keyIterator.next();
                if (key.indexOf(sharedPrefKeyPrefix(serviceName)) == 0) {
                    userNames.add(key.substring(sharedPrefKeyPrefix(serviceName).length()));
                }
            }

            NativeLogger.info("KeyStore: got " + userNames.size() + " users with stored secrets for " + serviceName);

            MessagePack msgpack = new MessagePack();
            return msgpack.write(userNames);
        } catch (Exception e) {
            NativeLogger.error("KeyStore: error getting users with stored secrets for " + serviceName, e);
            throw e;
        }
    }

    @Override
    public synchronized byte[] retrieveSecret(final String serviceName, final String key) throws Exception {
        String id = serviceName + ":" + key;
        NativeLogger.info("KeyStore: retrieving secret for " + id);

        try {
            final byte[] wrappedSecret = readWrappedSecret(prefs, sharedPrefKeyPrefix(serviceName) + key);
            Entry entry = ks.getEntry(keyStoreAlias(serviceName), null);

            if (entry == null) {
                throw new KeyStoreException("No RSA keys in the keystore");
            }

            if (!(entry instanceof PrivateKeyEntry)) {
                throw new KeyStoreException("Entry is not a PrivateKeyEntry. It is: " + entry.getClass());
            }

            try {
                byte[] secret = unwrapSecret((PrivateKeyEntry) entry, wrappedSecret).getEncoded();
                NativeLogger.info("KeyStore: retrieved " + secret.length + "-byte secret for " + id);
                return secret;
            } catch (InvalidKeyException e) {
                // Invalid key, this can happen when a user changes their lock screen from something to nothing
                // or enrolls a new finger. See https://developer.android.com/reference/android/security/keystore/KeyPermanentlyInvalidatedException.html
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && e instanceof KeyPermanentlyInvalidatedException) {
                    NativeLogger.info("KeyStore: key no longer valid; deleting entry", e);
                    ks.deleteEntry((keyStoreAlias(serviceName)));
                }
                throw e;
            }
        } catch (Exception e) {
            NativeLogger.error("KeyStore: error retrieving secret for " + id, e);
            throw e;
        }
    }

    @Override
    public synchronized void setupKeyStore(final String serviceName, final String key) throws Exception {
        String id = serviceName + ":" + key;
        NativeLogger.info("KeyStore: setting up key store for " + id);

        try {
            if (!ks.containsAlias(keyStoreAlias(serviceName))) {
                KeyStoreHelper.generateRSAKeyPair(context, keyStoreAlias(serviceName));
            }

            // Try to read the entry from the keystore.
            // The entry may exist, but it may not be readable by us.
            // (this happens when the app is uninstalled and reinstalled)
            // In that case, lets' delete the entry and recreate it.
            // Note we are purposely not recursing to avoid a state where we
            // constantly try to generate new RSA keys (which is slow)
            try {
                final Entry entry = ks.getEntry(keyStoreAlias(serviceName), null);
                if (entry == null) {
                    ks.deleteEntry(keyStoreAlias(serviceName));
                    KeyStoreHelper.generateRSAKeyPair(context, keyStoreAlias(serviceName));
                }
            } finally {
                // Reload the keystore
                ks = java.security.KeyStore.getInstance("AndroidKeyStore");
                ks.load(null);
            }
        } catch (Exception e) {
            NativeLogger.error("KeyStore: error setting up key store for " + id, e);
            throw e;
        }

        NativeLogger.info("KeyStore: finished setting up key store for " + id);
    }

    @Override
    public synchronized void storeSecret(final String serviceName, final String key, final byte[] bytes) throws Exception {
        String id = serviceName + ":" + key;
        NativeLogger.info("KeyStore: storing " + bytes.length + "-byte secret for " + id);

        try {
            Entry entry = ks.getEntry(keyStoreAlias(serviceName), null);

            if (entry == null) {
                throw new KeyStoreException("No RSA keys in the keystore");
            }

            final byte[] wrappedSecret = wrapSecret((PrivateKeyEntry) entry, new SecretKeySpec(bytes, ALGORITHM));

            if (wrappedSecret == null) {
                throw new IOException("Null return when wrapping secret");
            }

            saveWrappedSecret(prefs, sharedPrefKeyPrefix(serviceName) + key, wrappedSecret);
        } catch (Exception e) {
            NativeLogger.error("KeyStore: error storing secret for " + id, e);
            throw e;
        }

        NativeLogger.info("KeyStore: stored " + bytes.length + "-byte secret for " + id);
    }

    private static void saveWrappedSecret(SharedPreferences prefs, String prefsKey, byte[] wrappedSecret) {
        prefs.edit().putString(prefsKey, Base64.encodeToString(wrappedSecret, Base64.NO_WRAP)).apply();
    }


    private static byte[] readWrappedSecret(SharedPreferences prefs, String prefsKey) throws Exception {
        final String wrappedKey = prefs.getString(prefsKey, "");
        if (wrappedKey.isEmpty()) {
            throw new KeyStoreException("No secret for " + prefsKey);
        }
        return Base64.decode(wrappedKey, Base64.NO_WRAP);
    }

    /**
     * Similar to Android's example Vault https://github.com/android/platform_development/tree/master/samples/Vault
     */
    private static byte[] wrapSecret(PrivateKeyEntry entry, SecretKey key) throws NoSuchPaddingException, NoSuchAlgorithmException, InvalidKeyException, IllegalBlockSizeException, NoSuchProviderException {
        KeyPair mPair = new KeyPair(entry.getCertificate().getPublicKey(), entry.getPrivateKey());
        // This is the only cipher that's supported by AndroidKeystore (api version +18)
        // The padding makes sure this encryption isn't deterministic
        Cipher mCipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        mCipher.init(Cipher.WRAP_MODE, mPair.getPublic());
        return mCipher.wrap(key);
    }

    private static SecretKey unwrapSecret(PrivateKeyEntry entry, byte[] wrappedSecretKey) throws NoSuchPaddingException, NoSuchAlgorithmException, InvalidKeyException, IllegalBlockSizeException, NoSuchProviderException {
        KeyPair mPair = new KeyPair(entry.getCertificate().getPublicKey(), entry.getPrivateKey());
        Cipher mCipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        mCipher.init(Cipher.UNWRAP_MODE, mPair.getPrivate());
        return (SecretKey) mCipher.unwrap(wrappedSecretKey, ALGORITHM, Cipher.SECRET_KEY);
    }


}
