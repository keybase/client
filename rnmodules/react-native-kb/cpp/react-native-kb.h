// WARNING: Do NOT #include <msgpack.hpp> in this header.
// It defines a `nil` typedef that conflicts with ObjC's `nil` macro,
// causing build failures when this header is included from .mm files.
// Use #include "msgpack-safe.hpp" in .cpp files instead — it wraps the
// include with #undef/#pragma push/pop to handle the conflict safely.
#pragma once
#include <ReactCommon/CallInvoker.h>
#include "react-native-kb-experiments.h"
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

  enum class BinaryMode {
    uint8ArrayCtor,
    mutableArrayBuffer,
    mutableWrappedUint8Array,
  };

  void resetCaches(facebook::jsi::Runtime &runtime);
  facebook::jsi::Function &uint8ArrayCtor(facebook::jsi::Runtime &runtime);
  facebook::jsi::Value binaryFromBytes(facebook::jsi::Runtime &runtime,
                                       const char *ptr, size_t size,
                                       BinaryMode mode);
  facebook::jsi::Value convertMPToJSI(facebook::jsi::Runtime &runtime,
                                      void *mpObj);
  void convertJSIToMP(facebook::jsi::Runtime &runtime,
                      const facebook::jsi::Value &value, void *packer);
  void packAndSend(facebook::jsi::Runtime &runtime,
                   const facebook::jsi::Value &value);

#ifdef KB_JSI_EXPERIMENTS_ENABLED
  void installExperimentBindings(facebook::jsi::Runtime &runtime);
#endif

#if KB_JSI_PERF
  struct PerfCounters {
    std::atomic<uint64_t> rpcOnGoCalls{0};
    std::atomic<uint64_t> rpcOnGoBytes{0};
    std::atomic<uint64_t> encodeNs{0};
    std::atomic<uint64_t> frameNs{0};
    std::atomic<uint64_t> writeToGoNs{0};
    std::atomic<uint64_t> onDataCalls{0};
    std::atomic<uint64_t> onDataBytes{0};
    std::atomic<uint64_t> inboundMessages{0};
    std::atomic<uint64_t> unpackNs{0};
    std::atomic<uint64_t> convertMPToJSINs{0};
    std::atomic<uint64_t> rpcOnJsCalls{0};
    std::atomic<uint64_t> rpcOnJsNs{0};
  };

  PerfCounters perf_;

  void installPerfBindings(facebook::jsi::Runtime &runtime);
  void resetPerfCounters();
  facebook::jsi::Value perfStats(facebook::jsi::Runtime &runtime);
  facebook::jsi::Value perfRoundTrip(facebook::jsi::Runtime &runtime,
                                     const facebook::jsi::Value *arguments,
                                     size_t count);
  facebook::jsi::Value perfMakeBinary(facebook::jsi::Runtime &runtime,
                                      const facebook::jsi::Value *arguments,
                                      size_t count);
  facebook::jsi::Value convertMPToJSIPerf(facebook::jsi::Runtime &runtime,
                                          void *mpObj, BinaryMode mode);
#endif
};

} // namespace kb
