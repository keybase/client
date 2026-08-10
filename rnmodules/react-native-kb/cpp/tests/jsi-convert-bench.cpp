// Benchmark for the msgpack <-> JSI conversion in KBBridge, run on a real
// Hermes runtime against a corpus of real RPC payloads.
//
// The corpus comes from an actual mobile session's Metro log; see
// scripts/make-bench-corpus.mjs. Build and run both this and the master
// baseline with scripts/bench-jsi-convert.sh.
//
// Decode direction (msgpack -> JSI): frames are handed to onDataFromGo exactly
// as the platform reader would, and the installed rpcOnJs receives the
// converted values.
//
// Encode direction (JSI -> msgpack): the values rpcOnJs received are handed
// back to the global rpcOnGo the bridge installs, which packs them and calls
// writeToGo.
//
// Both directions therefore run through the public API, not through internals
// copied out of the implementation, so the two builds are measuring the same
// thing the app does.

#include "react-native-kb.h"

#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>

#include <hermes/hermes.h>

using namespace facebook;

namespace {

// The bridge only ever schedules work meant to run on the JS thread, and the
// benchmark is single threaded, so running inline is faithful.
class InlineCallInvoker : public react::CallInvoker {
public:
  explicit InlineCallInvoker(jsi::Runtime &rt) : rt_(rt) {}
  void invokeAsync(react::CallFunc &&func) noexcept override { func(rt_); }
  void invokeSync(react::CallFunc &&func) override { func(rt_); }

private:
  jsi::Runtime &rt_;
};

std::vector<uint8_t> readFile(const char *path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) {
    fprintf(stderr, "cannot open corpus %s\n", path);
    exit(1);
  }
  return std::vector<uint8_t>((std::istreambuf_iterator<char>(in)),
                              std::istreambuf_iterator<char>());
}

double msSince(std::chrono::steady_clock::time_point start) {
  return std::chrono::duration<double, std::milli>(
             std::chrono::steady_clock::now() - start)
      .count();
}

} // namespace

int main(int argc, char **argv) {
  const char *corpusPath =
      argc > 1 ? argv[1] : "/tmp/kb-bench-corpus.bin";
  const int iterations = argc > 2 ? atoi(argv[2]) : 5;

  auto corpus = readFile(corpusPath);
  auto runtime = facebook::hermes::makeHermesRuntime();
  auto &rt = *runtime;
  auto invoker = std::make_shared<InlineCallInvoker>(rt);
  auto bridge = std::make_shared<kb::KBBridge>();

  size_t bytesWritten = 0;
  size_t errors = 0;
  auto onError = [&](const std::string &msg) {
    if (errors++ < 5) {
      fprintf(stderr, "bridge error: %s\n", msg.c_str());
    }
  };

#ifdef KB_BASELINE
  bridge->install(
      rt, invoker,
      [&](void *, size_t size) { bytesWritten += size; },
      onError);
#else
  bridge->install(
      rt, invoker,
      [&](void *, size_t size) {
        bytesWritten += size;
        return true;
      },
      onError, [&](int64_t) { fprintf(stderr, "fatal\n"); });
#endif

  // Collects everything the decode pass produced so the encode pass has real
  // JSI values to pack. Held in JS so the values stay exactly what rpcOnJs got.
  rt.global().setProperty(rt, "received", jsi::Array(rt, 0));
  auto rpcOnJs = jsi::Function::createFromHostFunction(
      rt, jsi::PropNameID::forAscii(rt, "rpcOnJs"), 2,
      [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
         size_t argCount) -> jsi::Value {
        if (argCount < 2) {
          return jsi::Value::undefined();
        }
        auto arr = rt.global()
                       .getPropertyAsObject(rt, "received")
                       .getArray(rt);
        auto push = arr.getPropertyAsFunction(rt, "push");
        // Same unwrapping rule as JS's rpcOnJs: count > 1 means the argument
        // is a batch array, anything else is a single message.
        const int count = int(args[1].asNumber());
        if (count > 1) {
          auto batch = args[0].getObject(rt).getArray(rt);
          for (size_t i = 0, n = batch.size(rt); i < n; ++i) {
            push.callWithThis(rt, arr, batch.getValueAtIndex(rt, i));
          }
        } else {
          push.callWithThis(rt, arr, args[0]);
        }
        return jsi::Value::undefined();
      });
  rt.global().setProperty(rt, "rpcOnJs", std::move(rpcOnJs));

  size_t frames = 0;
  for (size_t off = 0; off + 5 <= corpus.size();) {
    uint32_t len = (uint32_t(corpus[off + 1]) << 24) |
                   (uint32_t(corpus[off + 2]) << 16) |
                   (uint32_t(corpus[off + 3]) << 8) | uint32_t(corpus[off + 4]);
    off += 5 + len;
    frames++;
  }

  printf("corpus %s: %zu frames, %.2f MB\n", corpusPath, frames,
         double(corpus.size()) / (1024 * 1024));
#ifdef KB_BASELINE
  printf("build: baseline (origin/master)\n");
#else
  printf("build: branch\n");
#endif

  double decodeBest = 1e18;
  double encodeBest = 1e18;
  for (int iter = 0; iter < iterations; ++iter) {
    // Decode: hand the corpus over in reads no larger than Go's ReadArr
    // buffer (go/bind/keybase.go), so batching and partial frames happen the
    // way they do on device rather than as one impossible 10MB read.
    constexpr size_t kReadSize = 300 * 1024;
    rt.global().setProperty(rt, "received", jsi::Array(rt, 0));
#ifndef KB_BASELINE
    bridge->resetRecv();
#endif
    auto t0 = std::chrono::steady_clock::now();
    for (size_t off = 0; off < corpus.size(); off += kReadSize) {
      const size_t n = std::min(kReadSize, corpus.size() - off);
#ifdef KB_BASELINE
      bridge->onDataFromGo(corpus.data() + off, int(n));
#else
      bridge->onDataFromGo(corpus.data() + off, int(n), 1);
#endif
    }
    double decodeMs = msSince(t0);

    auto received =
        rt.global().getPropertyAsObject(rt, "received").getArray(rt);
    size_t n = received.size(rt);
    auto rpcOnGo = rt.global().getPropertyAsFunction(rt, "rpcOnGo");
    bytesWritten = 0;
    auto t1 = std::chrono::steady_clock::now();
    for (size_t i = 0; i < n; ++i) {
      rpcOnGo.call(rt, received.getValueAtIndex(rt, i));
    }
    double encodeMs = msSince(t1);

    if (iter == 0) {
      printf("delivered %zu messages, repacked %zu bytes\n", n, bytesWritten);
    }
    decodeBest = std::min(decodeBest, decodeMs);
    encodeBest = std::min(encodeBest, encodeMs);
    printf("  iter %d: decode %8.2f ms   encode %8.2f ms\n", iter, decodeMs,
           encodeMs);
  }

  printf("best: decode %.2f ms   encode %.2f ms   (%d iterations)\n",
         decodeBest, encodeBest, iterations);
  // Any conversion error makes the timings meaningless (a build where every
  // message fails is the fastest one), so exit nonzero -- this doubles as a
  // smoke test of the bridge rather than reporting green on total failure.
  if (errors) {
    printf("errors reported: %zu\n", errors);
    return 1;
  }
  return 0;
}
