package io.keybase.android.keystore;

import android.annotation.TargetApi;
import android.content.Context;
import android.os.Build;
import android.security.KeyChain;
import android.security.KeyPairGeneratorSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.math.BigInteger;
import java.security.InvalidAlgorithmParameterException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.spec.AlgorithmParameterSpec;
import java.util.Calendar;

import javax.security.auth.x500.X500Principal;

public class KeyStoreHelper {

    @TargetApi(Build.VERSION_CODES.KITKAT)
    public static void generateRSAKeyPair(Context ctx, String keyAlias) throws KeyStoreException, NoSuchProviderException, NoSuchAlgorithmException, InvalidAlgorithmParameterException {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");

        final AlgorithmParameterSpec spec;
        final boolean isOnHardware;

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            // TODO: this this on android M
            spec = new KeyGenParameterSpec.Builder(
              keyAlias,
              KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
              .build();

            // TODO look at key info and see if crypto is hardware bounded
        } else {
            // TODO use this information
            isOnHardware = KeyChain.isBoundKeyAlgorithm("RSA");

            final Calendar endTime = Calendar.getInstance();
            endTime.add(Calendar.YEAR, 10);

            spec = new KeyPairGeneratorSpec.Builder(ctx)
              .setAlias(keyAlias)
              .setEncryptionRequired()
              .setSerialNumber(BigInteger.ONE)
              .setSubject(new X500Principal("CN=" + keyAlias))
              .setStartDate(Calendar.getInstance().getTime())
              .setEndDate(endTime.getTime())
              .setKeySize(4096)
              .build();
        }

        kpg.initialize(spec);
        KeyPair kp = kpg.generateKeyPair();
    }
}
