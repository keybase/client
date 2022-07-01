package io.keybase.ossifrage;

import android.content.Context;
import android.os.RemoteException;
import android.os.SystemClock;
import android.util.Log;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;

import io.keybase.ossifrage.modules.NativeLogger;
import keybase.StringReceiver;

public class KBInstallReferrerListener implements keybase.NativeInstallReferrerListener, InstallReferrerStateListener {

  private InstallReferrerClient mReferrerClient;
  private keybase.StringReceiver callback;
  private Context context;
  private int retries;
  private Executor executor;

  private static final int max_retries = 5;

  KBInstallReferrerListener(Context _context) {
    Log.d("KBIR", "KBInstallReferrerListener created");
    context = _context;
    executor = Executors.newSingleThreadExecutor();
    retries = 0;
  }

  // should only be called once per object
  @Override
  public void startInstallReferrerListener(StringReceiver cb) {
    Log.e("KBIR", "KBInstallReferrerListener started");

    mReferrerClient = InstallReferrerClient.newBuilder(this.context).build();
    mReferrerClient.startConnection(this);
    callback = cb;
  }

  @Override
  public void onInstallReferrerSetupFinished(int responseCode) {
    Log.e("KBIR", "KBInstallReferrerListener#onInstallReferrerSetupFinished: got code " + responseCode);
    executor.execute(new Runnable() {
      @Override
      public void run() {
        switch (responseCode) {
          case InstallReferrerClient.InstallReferrerResponse.OK:
            // Connection established
            handleReferrerResponseOK();
            return;
          case InstallReferrerClient.InstallReferrerResponse.SERVICE_DISCONNECTED:
            reconnect();
            return;
          case InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED:
          case InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE:
          case InstallReferrerClient.InstallReferrerResponse.DEVELOPER_ERROR:
          default:
            // other issues, can't do much here....
            callback.callbackWithString("");
        }
      }
    });
  }

  private void handleReferrerResponseOK() {
    try {
      ReferrerDetails response = mReferrerClient.getInstallReferrer();
      String referrerData = response.getInstallReferrer();
      callback.callbackWithString(referrerData);
    } catch (RemoteException e) {
      Log.e("KBIR", "KBInstallReferrerListener#handleReferrerResponseOK got exception: " + e.toString());
      e.printStackTrace();
      callback.callbackWithString("");
    }
    mReferrerClient.endConnection();
  }

  // tries to reconnect up to max_retries times in case of errors
  private void reconnect() {
    if (retries >= max_retries) {
      Log.e("KBIR", "KBInstallReferrerListener max reconnection attempts exceeded");
      callback.callbackWithString("");
      mReferrerClient.endConnection();
      return;
    }

    retries++;
    // sleep for a bit, hopefully when we wake up the play store
    // connection will be available.
    SystemClock.sleep(retries * 1000);
    Log.e("KBIR", "KBInstallReferrerListener reconnecting...");
    mReferrerClient.startConnection(this);
  }

  @Override
  public void onInstallReferrerServiceDisconnected() {
    Log.e("KBIR", "KBInstallReferrerListener#onInstallReferrerServiceDisconnected: attempting restart...");
    executor.execute(new Runnable() {
      @Override
      public void run() {
        reconnect();
      }
    });
  }
}