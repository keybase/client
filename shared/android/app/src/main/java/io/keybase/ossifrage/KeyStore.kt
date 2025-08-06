package io.keybase.ossifrage

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.util.Base64
import io.keybase.ossifrage.keystore.KeyStoreHelper
import io.keybase.ossifrage.modules.NativeLogger
import keybase.UnsafeExternalKeyStore
import org.msgpack.core.MessagePack
import java.io.IOException
import java.security.InvalidKeyException
import java.security.KeyPair
import java.security.KeyStore
import java.security.KeyStoreException
import java.security.NoSuchAlgorithmException
import java.security.NoSuchProviderException
import javax.crypto.Cipher
import javax.crypto.IllegalBlockSizeException
import javax.crypto.NoSuchPaddingException
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

class KeyStore(private val context: Context, private val prefs: SharedPreferences) : UnsafeExternalKeyStore {
    private var ks: KeyStore

    init {
        ks = KeyStore.getInstance("AndroidKeyStore")
        ks.load(null)
        NativeLogger.info("KeyStore: initialized")
    }

    private fun sharedPrefKeyPrefix(serviceName: String): String {
        return serviceName + PREFS_KEY
    }

    private fun keyStoreAlias(serviceName: String): String {
        return serviceName + KEY_ALIAS
    }

    @SuppressLint("CommitPrefEdits")
    @Throws(Exception::class)
    override fun clearSecret(serviceName: String, key: String) {
        val id = "$serviceName:$key"
        NativeLogger.info("KeyStore: clearing secret for $id")
        try {
            prefs.edit().remove(sharedPrefKeyPrefix(serviceName) + key).commit()
        } catch (e: Exception) {
            NativeLogger.error("KeyStore: error clearing secret for $id", e)
            throw e
        }
        NativeLogger.info("KeyStore: cleared secret for $id")
    }

    @Synchronized
    @Throws(Exception::class)
    override fun getUsersWithStoredSecretsMsgPack(serviceName: String): ByteArray {
        NativeLogger.info("KeyStore: getting users with stored secrets for $serviceName")
        return try {
            val keyIterator: Iterator<String> = prefs.all.keys.iterator()
            val userNames = ArrayList<String>()
            while (keyIterator.hasNext()) {
                val key = keyIterator.next()
                if (key.indexOf(sharedPrefKeyPrefix(serviceName)) == 0) {
                    userNames.add(key.substring(sharedPrefKeyPrefix(serviceName).length))
                }
            }
            NativeLogger.info("KeyStore: got " + userNames.size + " users with stored secrets for " + serviceName)
            val packer = MessagePack.newDefaultBufferPacker()
            packer.packArrayHeader(userNames.size)
            for (s in userNames) {
                packer.packString(s)
            }
            packer.close()
            packer.toByteArray()
        } catch (e: Exception) {
            NativeLogger.error("KeyStore: error getting users with stored secrets for $serviceName", e)
            throw e
        }
    }

    @Synchronized
    @Throws(Exception::class)
    override fun retrieveSecret(serviceName: String, key: String): ByteArray {
        val id = "$serviceName:$key"
        NativeLogger.info("KeyStore: retrieving secret for $id")
        return try {
            val wrappedSecret = readWrappedSecret(prefs, sharedPrefKeyPrefix(serviceName) + key)
            val entry = ks.getEntry(keyStoreAlias(serviceName), null)
                    ?: throw KeyStoreException("No RSA keys in the keystore")
            if (entry !is KeyStore.PrivateKeyEntry) {
                throw KeyStoreException("Entry is not a PrivateKeyEntry. It is: " + entry.javaClass)
            }
            try {
                val secret = unwrapSecret(entry, wrappedSecret).encoded
                NativeLogger.info("KeyStore: retrieved " + secret.size + "-byte secret for " + id)
                secret
            } catch (e: InvalidKeyException) {
                // Invalid key, this can happen when a user changes their lock screen from something to nothing
                // or enrolls a new finger. See https://developer.android.com/reference/android/security/keystore/KeyPermanentlyInvalidatedException.html
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && e is KeyPermanentlyInvalidatedException) {
                    NativeLogger.info("KeyStore: key no longer valid; deleting entry", e)
                    ks.deleteEntry(keyStoreAlias(serviceName))
                }
                throw e
            }
        } catch (e: Exception) {
            NativeLogger.error("KeyStore: error retrieving secret for $id", e)
            throw e
        }
    }

    @Synchronized
    @Throws(Exception::class)
    override fun setupKeyStore(serviceName: String, key: String) {
        val id = "$serviceName:$key"
        NativeLogger.info("KeyStore: setting up key store for $id")
        try {
            if (!ks.containsAlias(keyStoreAlias(serviceName))) {
                KeyStoreHelper.generateRSAKeyPair(context, keyStoreAlias(serviceName))
            }

            // Try to read the entry from the keystore.
            // The entry may exist, but it may not be readable by us.
            // (this happens when the app is uninstalled and reinstalled)
            // In that case, lets' delete the entry and recreate it.
            // Note we are purposely not recursing to avoid a state where we
            // constantly try to generate new RSA keys (which is slow)
            try {
                val entry = ks.getEntry(keyStoreAlias(serviceName), null)
                if (entry == null) {
                    ks.deleteEntry(keyStoreAlias(serviceName))
                    KeyStoreHelper.generateRSAKeyPair(context, keyStoreAlias(serviceName))
                }
            } finally {
                // Reload the keystore
                ks = KeyStore.getInstance("AndroidKeyStore")
                ks.load(null)
            }
        } catch (e: Exception) {
            NativeLogger.error("KeyStore: error setting up key store for $id", e)
            throw e
        }
        NativeLogger.info("KeyStore: finished setting up key store for $id")
    }

    @Synchronized
    @Throws(Exception::class)
    override fun storeSecret(serviceName: String, key: String, bytes: ByteArray) {
        val id = "$serviceName:$key"
        NativeLogger.info("KeyStore: storing " + bytes.size + "-byte secret for " + id)
        try {
            val entry = ks.getEntry(keyStoreAlias(serviceName), null)
                    ?: throw KeyStoreException("No RSA keys in the keystore")
            val wrappedSecret = wrapSecret(entry as KeyStore.PrivateKeyEntry, SecretKeySpec(bytes, ALGORITHM))
            saveWrappedSecret(prefs, sharedPrefKeyPrefix(serviceName) + key, wrappedSecret)
        } catch (e: Exception) {
            NativeLogger.error("KeyStore: error storing secret for $id", e)
            throw e
        }
        NativeLogger.info("KeyStore: stored " + bytes.size + "-byte secret for " + id)
    }

    companion object {
        // Prefix for the key we use when we place the data in shared preferences
        private const val PREFS_KEY = "_wrappedKey_"

        // The name of the key we use to store our created RSA keypair in android's keystore
        private const val KEY_ALIAS = "_keybase-rsa-wrapper_"
        private const val ALGORITHM = "RSA_SECRETBOX"
        private fun saveWrappedSecret(prefs: SharedPreferences, prefsKey: String, wrappedSecret: ByteArray) {
            prefs.edit().putString(prefsKey, Base64.encodeToString(wrappedSecret, Base64.NO_WRAP)).apply()
        }

        @Throws(Exception::class)
        private fun readWrappedSecret(prefs: SharedPreferences, prefsKey: String): ByteArray {
            val wrappedKey = prefs.getString(prefsKey, "")
            if (wrappedKey!!.isEmpty()) {
                throw KeyStoreException("No secret for $prefsKey")
            }
            return Base64.decode(wrappedKey, Base64.NO_WRAP)
        }

        /**
         * Similar to Android's example Vault https://github.com/android/platform_development/tree/master/samples/Vault
         */
        @Throws(NoSuchPaddingException::class, NoSuchAlgorithmException::class, InvalidKeyException::class, IllegalBlockSizeException::class, NoSuchProviderException::class)
        private fun wrapSecret(entry: KeyStore.PrivateKeyEntry, key: SecretKey): ByteArray {
            val mPair = KeyPair(entry.certificate.publicKey, entry.privateKey)
            // This is the only cipher that's supported by AndroidKeystore (api version +18)
            // The padding makes sure this encryption isn't deterministic
            val mCipher = Cipher.getInstance("RSA/ECB/PKCS1Padding")
            mCipher.init(Cipher.WRAP_MODE, mPair.public)
            return mCipher.wrap(key)
        }

        @Throws(NoSuchPaddingException::class, NoSuchAlgorithmException::class, InvalidKeyException::class, IllegalBlockSizeException::class, NoSuchProviderException::class)
        private fun unwrapSecret(entry: KeyStore.PrivateKeyEntry, wrappedSecretKey: ByteArray): SecretKey {
            val mPair = KeyPair(entry.certificate.publicKey, entry.privateKey)
            val mCipher = Cipher.getInstance("RSA/ECB/PKCS1Padding")
            mCipher.init(Cipher.UNWRAP_MODE, mPair.private)
            return mCipher.unwrap(wrappedSecretKey, ALGORITHM, Cipher.SECRET_KEY) as SecretKey
        }
    }
}
