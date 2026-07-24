// WARNING: Do NOT #include <msgpack.hpp> in this header.
// It defines a `nil` typedef that conflicts with ObjC's `nil` macro,
// causing build failures when this header is included from .mm files.
// Use #include "msgpack-safe.hpp" in .cpp files instead — it wraps the
// include with #undef/#pragma push/pop to handle the conflict safely.
#pragma once
#include <ReactCommon/CallInvoker.h>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

namespace kb {

class KBBridge : public std::enable_shared_from_this<KBBridge> {
public:
  KBBridge();
  ~KBBridge();
  KBBridge(const KBBridge &) = delete;
  KBBridge &operator=(const KBBridge &) = delete;
  KBBridge(KBBridge &&) = delete;
  KBBridge &operator=(KBBridge &&) = delete;

  // `writeToGo` returns false if the native write failed, so the caller's
  // RPC can be failed instead of hanging forever waiting for a reply.
  // `onFatal` is invoked when the incoming byte stream can no longer be
  // trusted (desynced framing, oversized frame). The platform layer is
  // expected to reset the Go connection and emit the engine-reset meta
  // event so JS fails its outstanding RPCs.
  void install(facebook::jsi::Runtime &runtime,
               std::shared_ptr<facebook::react::CallInvoker> callInvoker,
               std::function<bool(void *ptr, size_t size)> writeToGo,
               std::function<void(const std::string &)> onError,
               std::function<void()> onFatal);

  // Any thread.
  void onDataFromGo(uint8_t *data, int size);

  // Any thread. Stops all further work. Does NOT touch JSI state, so it is
  // safe to call from the main thread / module invalidation.
  void markTornDown();

  // JS thread ONLY — destroys cached jsi handles, which is undefined
  // behavior off the runtime's thread.
  void teardown();
  void tearup();

private:
  std::shared_ptr<facebook::react::CallInvoker> callInvoker_;
  std::function<void(const std::string &)> onError_;
  std::function<void()> onFatal_;
  std::function<bool(void *ptr, size_t size)> writeToGo_;
  std::atomic<bool> isTornDown_{false};

  enum class ReadState { needSize, needContent };

  // Incoming stream state. Touched only from the native reader thread, and
  // under recvMutex_ so a stray second reader can't corrupt the unpacker.
  struct RecvState;
  std::mutex recvMutex_;
  std::unique_ptr<RecvState> recv_;

  // Outgoing scratch buffer. JS thread only.
  struct SendState;
  std::unique_ptr<SendState> send_;
  bool packing_ = false;

  std::unique_ptr<facebook::jsi::Function> cachedUint8ArrayCtor_;
  std::unique_ptr<facebook::jsi::Function> cachedIsView_;
  std::unique_ptr<facebook::jsi::PropNameID> cachedRpcOnJsName_;
  std::unordered_map<std::string, facebook::jsi::PropNameID> cachedPropNames_;
  std::string propNameScratch_;
  facebook::jsi::Runtime *cachedRuntime_ = nullptr;

  void resetCaches(facebook::jsi::Runtime &runtime);
  void releaseJSIState();
  // Requires recvMutex_.
  void resetRecvLocked();
  void reportError(const std::string &msg);

  // Sets obj[key] = value, reusing an interned PropNameID when possible.
  void setObjectKey(facebook::jsi::Runtime &runtime,
                    facebook::jsi::Object &obj, const char *ptr, size_t size,
                    const facebook::jsi::Value &value);
  facebook::jsi::Function &uint8ArrayCtor(facebook::jsi::Runtime &runtime);
  facebook::jsi::Function &arrayBufferIsView(facebook::jsi::Runtime &runtime);
  bool isArrayBufferView(facebook::jsi::Runtime &runtime,
                         const facebook::jsi::Object &obj);
  facebook::jsi::Value binaryFromBytes(facebook::jsi::Runtime &runtime,
                                       const char *ptr, size_t size);
  facebook::jsi::Value convertMPToJSI(facebook::jsi::Runtime &runtime,
                                      void *mpObj);
  void convertJSIToMP(facebook::jsi::Runtime &runtime,
                      const facebook::jsi::Value &value, void *packer);
  bool packAndSend(facebook::jsi::Runtime &runtime,
                   const facebook::jsi::Value &value);
};

} // namespace kb
