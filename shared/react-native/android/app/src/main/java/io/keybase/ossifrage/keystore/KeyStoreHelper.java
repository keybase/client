package io.keybase.ossifrage.keystore;

import android.annotation.TargetApi;
import android.content.Context;
import android.os.Build;
import android.security.KeyChain;
import android.security.KeyPairGeneratorSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;

import java.math.BigInteger;
import java.security.InvalidAlgorithmParameterException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.PrivateKey;
import java.security.spec.AlgorithmParameterSpec;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.RSAKeyGenParameterSpec;
import java.util.Calendar;

import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.security.auth.x500.X500Principal;

public class KeyStoreHelper {

    @TargetApi(Build.VERSION_CODES.KITKAT)
    public static void generateRSAKeyPair(Context ctx, String keyAlias) throws KeyStoreException, NoSuchProviderException, NoSuchAlgorithmException, InvalidAlgorithmParameterException {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");

        final AlgorithmParameterSpec spec;
        final Calendar endTime = Calendar.getInstance();
        endTime.add(Calendar.YEAR, 10);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            spec = new KeyGenParameterSpec.Builder(
              keyAlias,
              KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
              .setBlockModes(KeyProperties.BLOCK_MODE_ECB)
              .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_PKCS1)
              .setCertificateSerialNumber(BigInteger.ONE)
              .setCertificateSubject(new X500Principal("CN=" + keyAlias))
              .setKeySize(2048)
              .build();
        } else {
            spec = new KeyPairGeneratorSpec.Builder(ctx)
              .setAlias(keyAlias)
              .setEncryptionRequired()
              .setSerialNumber(BigInteger.ONE)
              .setSubject(new X500Principal("CN=" + keyAlias))
              .setStartDate(Calendar.getInstance().getTime())
              .setEndDate(endTime.getTime())
              .setKeySize(2048)
              .build();
        }

        kpg.initialize(spec);
        KeyPair kp = kpg.generateKeyPair();
    }
}
