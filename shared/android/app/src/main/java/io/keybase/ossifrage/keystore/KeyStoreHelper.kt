package io.keybase.ossifrage.keystore

import android.annotation.TargetApi
import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.math.BigInteger
import java.security.InvalidAlgorithmParameterException
import java.security.KeyPairGenerator
import java.security.KeyStoreException
import java.security.NoSuchAlgorithmException
import java.security.NoSuchProviderException
import java.security.spec.AlgorithmParameterSpec
import java.util.Calendar
import javax.security.auth.x500.X500Principal

object KeyStoreHelper {
    @TargetApi(Build.VERSION_CODES.KITKAT)
    @Throws(KeyStoreException::class, NoSuchProviderException::class, NoSuchAlgorithmException::class, InvalidAlgorithmParameterException::class)
    fun generateRSAKeyPair(ctx: Context?, keyAlias: String) {
        val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore")
        val spec: AlgorithmParameterSpec
        val endTime = Calendar.getInstance()
        endTime.add(Calendar.YEAR, 10)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            spec = KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_ECB)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_PKCS1)
                    .setCertificateSerialNumber(BigInteger.ONE)
                    .setCertificateSubject(X500Principal("CN=$keyAlias"))
                    .setKeySize(2048)
                    .build()
        } else {
            @Suppress("DEPRECATION")
            spec = android.security.KeyPairGeneratorSpec.Builder(ctx!!)
                    .setAlias(keyAlias)
                    .setEncryptionRequired()
                    .setSerialNumber(BigInteger.ONE)
                    .setSubject(X500Principal("CN=$keyAlias"))
                    .setStartDate(Calendar.getInstance().time)
                    .setEndDate(endTime.time)
                    .setKeySize(2048)
                    .build()
        }
        kpg.initialize(spec)
        kpg.generateKeyPair()
    }
}
