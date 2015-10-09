package io.keybase.android;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import java.io.IOException;
import java.security.InvalidKeyException;
import java.security.KeyPair;
import java.security.KeyStore.Entry;
import java.security.KeyStore.PrivateKeyEntry;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.cert.CertificateException;

import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import go.keybase.Keybase;
import io.keybase.android.keystore.KeyStoreHelper;

public class KeyStore extends Keybase.ExternalKeyStore.Stub {
    private final Context context;
    private final SharedPreferences prefs;
    private final java.security.KeyStore ks;

    private static final String PREFS_KEY = "wrappedKey_";
    private static final String KEY_ALIAS = "keybase-rsa-wrapper_";

    public KeyStore(final Context context, final SharedPreferences prefs) throws KeyStoreException, CertificateException, NoSuchAlgorithmException, IOException {
        this.context = context;
        this.prefs = prefs;

        ks = java.security.KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
    }


    @Override
    public void ClearSecret(final String username) throws Exception {
        ks.deleteEntry(KEY_ALIAS);
    }

    @Override
    public byte[] GetUsersWithStoredSecretsMsgPack() throws Exception {
        return new byte[0];
    }

    @Override
    public byte[] RetrieveSecret(final String username) throws Exception {
        final byte[] wrappedSecret = readWrappedSecret(prefs, PREFS_KEY + username);
        Entry entry;
        try {
            entry = ks.getEntry(KEY_ALIAS, null);
        } catch (Exception e) {
            return null;
        }

        if (wrappedSecret == null) {
            return null;
        }

        if (entry == null || !(entry instanceof PrivateKeyEntry)){
            return null;
        }

        return unwrapSecret((PrivateKeyEntry) entry, wrappedSecret).getEncoded();
    }

    @Override
    public void StoreSecret(final String username, final byte[] bytes) throws Exception {
        try {
            storeSecret(username, bytes);
        } catch (KeyStoreException e) {
            // Try deleting the Keystore entry and creating new rsa keys
            KeyStoreHelper.recreateKeyStoreEntry(context, ks, KEY_ALIAS);
            storeSecret(username, bytes);
        }

    }

    @Override
    public String GetTerminalPrompt() {
        return "Store secret in Android's KeyStore?";
    }

    @Override
    public void SetupKeyStore(final String username) throws Exception {
        if (!ks.containsAlias(KEY_ALIAS)) {
            KeyStoreHelper.generateRSAKeyPair(context, ks, KEY_ALIAS);
        }
    }

    private void storeSecret(final String username, final byte[] bytes) throws Exception {
        Entry entry = null;

        try {
            entry = ks.getEntry(KEY_ALIAS, null);
        } catch (Exception e) {
            throw new KeyStoreException("Failed to get the RSA keys from the keystore");
        }

        if (entry == null) {
            throw new KeyStoreException("No RSA keys in the keystore");
        }

        final byte[] wrappedSecret = wrapSecret((PrivateKeyEntry) entry, new SecretKeySpec(bytes, "SECRETBOX"));

        if (wrappedSecret == null) {
            throw new IOException("Null return when wrapping secret");
        }

        saveWrappedSecret(prefs, PREFS_KEY + username, wrappedSecret);
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

    private SecretKey unwrapSecret(PrivateKeyEntry entry, byte[] wrappedSecretKey) throws NoSuchPaddingException, NoSuchAlgorithmException, InvalidKeyException, IllegalBlockSizeException, NoSuchProviderException {
        KeyPair mPair = new KeyPair(entry.getCertificate().getPublicKey(), entry.getPrivateKey());
        Cipher mCipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        mCipher.init(Cipher.UNWRAP_MODE, mPair.getPrivate());
        return (SecretKey) mCipher.unwrap(wrappedSecretKey, "SECRETBOX", Cipher.SECRET_KEY);
    }


}
