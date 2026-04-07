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
#include <string>
#include <vector>

namespace kb {

class KBBridge : public std::enable_shared_from_this<KBBridge> {
public:
  KBBridge();
  ~KBBridge();
  KBBridge(const KBBridge &) = delete;
  KBBridge &operator=(const KBBridge &) = delete;
  KBBridge(KBBridge &&) = delete;
  KBBridge &operator=(KBBridge &&) = delete;
  void install(facebook::jsi::Runtime &runtime,
               std::shared_ptr<facebook::react::CallInvoker> callInvoker,
               std::function<void(void *ptr, size_t size)> writeToGo,
               std::function<void(const std::string &)> onError);

  void onDataFromGo(uint8_t *data, int size);
  void teardown();
  void tearup();

private:
  std::shared_ptr<facebook::react::CallInvoker> callInvoker_;
  std::function<void(const std::string &)> onError_;
  std::atomic<bool> isTornDown_{false};

  enum class ReadState { needSize, needContent };
  ReadState readState_ = ReadState::needSize;

  struct MsgpackState;
  std::unique_ptr<MsgpackState> mp_;

  std::unique_ptr<facebook::jsi::Function> cachedUint8ArrayCtor_;
  std::unique_ptr<facebook::jsi::Function> cachedRpcOnJs_;
  facebook::jsi::Runtime *cachedRuntime_ = nullptr;
  std::function<void(void *ptr, size_t size)> writeToGo_;
  std::vector<uint8_t> combinedBuf_;

  void resetCaches(facebook::jsi::Runtime &runtime);
  facebook::jsi::Value convertMPToJSI(facebook::jsi::Runtime &runtime,
                                      void *mpObj);
  void convertJSIToMP(facebook::jsi::Runtime &runtime,
                      const facebook::jsi::Value &value, void *packer);
  void packAndSend(facebook::jsi::Runtime &runtime,
                   const facebook::jsi::Value &value);
};

} // namespace kb
