package io.keybase.ossifrage;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
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

import go.keybase.Keybase;
import io.keybase.ossifrage.keystore.KeyStoreHelper;

public class KeyStore implements Keybase.ExternalKeyStore {
    private final Context context;
    private final SharedPreferences prefs;
    private final java.security.KeyStore ks;

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
    }

    private String sharedPrefKeyPrefix(final String serviceName) {
        return serviceName + PREFS_KEY;
    }

    private String keyStoreAlias(final String serviceName) {
        return serviceName + KEY_ALIAS;
    }

    @SuppressLint("CommitPrefEdits")
    @Override
    public void ClearSecret(final String serviceName, final String key) throws Exception {
        prefs.edit().remove(sharedPrefKeyPrefix(serviceName) + key).commit();
    }

    @Override
    public synchronized byte[] GetUsersWithStoredSecretsMsgPack(final String serviceName) throws Exception {
        final Iterator<String> keyIterator = prefs.getAll().keySet().iterator();
        final ArrayList<String> userNames = new ArrayList<>();

        while (keyIterator.hasNext()) {
            final String key = keyIterator.next();
            if (key.indexOf(sharedPrefKeyPrefix(serviceName)) == 0) {
                userNames.add(key.substring(sharedPrefKeyPrefix(serviceName).length()));
            }
        }

        MessagePack msgpack = new MessagePack();
        return msgpack.write(userNames);
    }

    @Override
    public synchronized byte[] RetrieveSecret(final String serviceName, final String key) throws Exception {
        final byte[] wrappedSecret = readWrappedSecret(prefs, sharedPrefKeyPrefix(serviceName) + key);
        Entry entry;
        try {
            entry = ks.getEntry(keyStoreAlias(serviceName), null);
        } catch (Exception e) {
            return null;
        }

        if (wrappedSecret == null) {
            return null;
        }

        if (!(entry instanceof PrivateKeyEntry)){
            return null;
        }

        return unwrapSecret((PrivateKeyEntry) entry, wrappedSecret).getEncoded();
    }

    @Override
    public synchronized void SetupKeyStore(final String serviceName, final String key) throws Exception {
        if (!ks.containsAlias(keyStoreAlias(serviceName))) {
            KeyStoreHelper.generateRSAKeyPair(context, keyStoreAlias(serviceName));
        }

        // Try to read the entry from the keystore.
        // The entry may exists, but it may not be readable by us.
        // (this happens when the app is uninstalled and reinstalled)
        // In that case, lets' delete the entry and recreate it.
        // Note we are purposely not recursing to avoid a state where we
        // Constantly try to generate new RSA keys (which is slow)
        try {
            final Entry entry = ks.getEntry(keyStoreAlias(serviceName), null);
            if (entry == null) {
                throw new NullPointerException("Null Entry");
            }
        } catch (Exception e) {
            ks.deleteEntry(keyStoreAlias(serviceName));
            KeyStoreHelper.generateRSAKeyPair(context, keyStoreAlias(serviceName));
        }
    }

    @Override
    public synchronized void StoreSecret(final String serviceName, final String key, final byte[] bytes) throws Exception {
        Entry entry = null;

        try {
            entry = ks.getEntry(keyStoreAlias(serviceName), null);
        } catch (Exception e) {
            throw new KeyStoreException("Failed to get the RSA keys from the keystore");
        }

        if (entry == null) {
            throw new KeyStoreException("No RSA keys in the keystore");
        }

        final byte[] wrappedSecret = wrapSecret((PrivateKeyEntry) entry, new SecretKeySpec(bytes, ALGORITHM));

        if (wrappedSecret == null) {
            throw new IOException("Null return when wrapping secret");
        }

        saveWrappedSecret(prefs, sharedPrefKeyPrefix(serviceName) + key, wrappedSecret);
    }

    private static void saveWrappedSecret(SharedPreferences prefs, String prefsKey, byte[] wrappedSecret) {
        prefs.edit().putString(prefsKey, Base64.encodeToString(wrappedSecret, Base64.NO_WRAP)).apply();
    }


    private static byte[] readWrappedSecret(SharedPreferences prefs, String prefsKey) {
        final String wrappedKey = prefs.getString(prefsKey,"");
        if (wrappedKey.isEmpty()) {
            return null;
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
