package io.keybase.ossifrage

import android.content.Context
import android.os.RemoteException
import android.os.SystemClock
import android.util.Log
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import keybase.NativeInstallReferrerListener
import keybase.StringReceiver
import java.util.concurrent.Executor
import java.util.concurrent.Executors

class KBInstallReferrerListener internal constructor(_context: Context) : NativeInstallReferrerListener, InstallReferrerStateListener {
    private var mReferrerClient: InstallReferrerClient? = null
    private var callback: StringReceiver? = null
    private val context: Context
    private var retries: Int
    private val executor: Executor

    init {
        Log.d("KBIR", "KBInstallReferrerListener created")
        context = _context
        executor = Executors.newSingleThreadExecutor()
        retries = 0
    }

    // should only be called once per object
    override fun startInstallReferrerListener(cb: StringReceiver) {
        Log.e("KBIR", "KBInstallReferrerListener started")
        val rc = InstallReferrerClient.newBuilder(context).build()
        mReferrerClient = rc
        rc.startConnection(this)
        callback = cb
    }

    override fun onInstallReferrerSetupFinished(responseCode: Int) {
        Log.e("KBIR", "KBInstallReferrerListener#onInstallReferrerSetupFinished: got code $responseCode")
        executor.execute(Runnable {
            when (responseCode) {
                InstallReferrerClient.InstallReferrerResponse.OK -> {
                    // Connection established
                    handleReferrerResponseOK()
                    return@Runnable
                }

                InstallReferrerClient.InstallReferrerResponse.SERVICE_DISCONNECTED -> {
                    reconnect()
                    return@Runnable
                }

                InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED, InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE, InstallReferrerClient.InstallReferrerResponse.DEVELOPER_ERROR ->             // other issues, can't do much here....
                    callback!!.callbackWithString("")

                else -> callback!!.callbackWithString("")
            }
        })
    }

    private fun handleReferrerResponseOK() {
        try {
            val response = mReferrerClient!!.installReferrer
            val referrerData = response.installReferrer
            callback!!.callbackWithString(referrerData)
        } catch (e: RemoteException) {
            Log.e("KBIR", "KBInstallReferrerListener#handleReferrerResponseOK got exception: $e")
            e.printStackTrace()
            callback!!.callbackWithString("")
        }
        mReferrerClient!!.endConnection()
    }

    // tries to reconnect up to max_retries times in case of errors
    private fun reconnect() {
        if (retries >= max_retries) {
            Log.e("KBIR", "KBInstallReferrerListener max reconnection attempts exceeded")
            callback!!.callbackWithString("")
            mReferrerClient!!.endConnection()
            return
        }
        retries++
        // sleep for a bit, hopefully when we wake up the play store
        // connection will be available.
        SystemClock.sleep((retries * 1000).toLong())
        Log.e("KBIR", "KBInstallReferrerListener reconnecting...")
        mReferrerClient!!.startConnection(this)
    }

    override fun onInstallReferrerServiceDisconnected() {
        Log.e("KBIR", "KBInstallReferrerListener#onInstallReferrerServiceDisconnected: attempting restart...")
        executor.execute { reconnect() }
    }

    companion object {
        private const val max_retries = 5
    }
}