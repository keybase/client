package io.keybase.ossifrage.modules;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static keybase.Keybase.readArr;
import static keybase.Keybase.writeArr;

@ReactModule(name = GoJSIBridge.NAME)
public class GoJSIBridge extends ReactContextBaseJavaModule {
    public static final String NAME = "GoJSIBridge";
    private native void nativeInstall(long jsiPtr);
    private native void nativeEmit(long jsiPtr, CallInvokerHolderImpl jsInvoker, byte[] data);
    private ExecutorService executor;
    private ReactApplicationContext reactContext;
    private Boolean installed = false;

    public GoJSIBridge(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    private class ReadFromKBLib implements Runnable {
        private final ReactApplicationContext reactContext;

        public ReadFromKBLib(ReactApplicationContext reactContext) {
            this.reactContext = reactContext;

            reactContext.addLifecycleEventListener(new LifecycleEventListener() {
                @Override
                public void onHostResume() {
                    if (installed && executor == null) {
                        executor = Executors.newSingleThreadExecutor();
                        executor.execute(new ReadFromKBLib(reactContext));
                    }
                }

                @Override
                public void onHostPause() {
                }

                @Override
                public void onHostDestroy() {
                    destroy();
                }
            });
        }

        @Override
        public void run() {
            do {
                try {
                    Thread.currentThread().setName("ReadFromKBLib");
                    final byte[] data = readArr();

                    if (!reactContext.hasActiveCatalystInstance()) {
                        NativeLogger.info(NAME + ": JS Bridge is dead, dropping engine message: " + data);
                    }

                    CallInvokerHolderImpl callInvoker = (CallInvokerHolderImpl) reactContext.getCatalystInstance().getJSCallInvokerHolder();
                    nativeEmit(reactContext.getJavaScriptContextHolder().get(), callInvoker, data);
                } catch (Exception e) {
                    if (e.getMessage().equals("Read error: EOF")) {
                        NativeLogger.info("Got EOF from read. Likely because of reset.");
                    } else {
                        NativeLogger.error("Exception in ReadFromKBLib.run", e);
                    }
                }
            } while (!Thread.currentThread().isInterrupted() && reactContext.hasActiveCatalystInstance());
        }
    }

    public void destroy() {
        try {
            if (executor != null) {
                executor.shutdownNow();
            }

            // We often hit this timeout during app resume, e.g. hit the back
            // button to go to home screen and then tap Keybase app icon again.
            if (executor != null && !executor.awaitTermination(3, TimeUnit.SECONDS)) {
                NativeLogger.warn(NAME + ": Executor pool didn't shut down cleanly");
            }
            executor = null;
        } catch (Exception e) {
            NativeLogger.error("Exception in KeybaseEngine.destroy", e);
        }
    }

    @Override
    @NonNull
    public String getName() {
        return NAME;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean install() {
        installed = true;
        try {
            System.loadLibrary("gojsi");

            ReactApplicationContext context = getReactApplicationContext();
            CallInvokerHolderImpl callInvokerHolder = (CallInvokerHolderImpl) context.getCatalystInstance().getJSCallInvokerHolder();
            this.nativeInstall(context.getJavaScriptContextHolder().get());

            if (executor == null) {
                executor = Executors.newSingleThreadExecutor();
                executor.execute(new ReadFromKBLib(this.reactContext));
            }
            return true;
        } catch (Exception exception) {
            return false;
        }
    }

    public void rpcOnGo(byte[] arr) {
        try {
            writeArr(arr);
        } catch (Exception e) {
            NativeLogger.error("Exception in GoJSIBridge.rpcOnGo", e);
        }
    }
}
