// Correctness tests for the msgpack <-> JSI bridge in react-native-kb.cpp:
// packNumber's integer-encoding range checks, convertMPToJSI /
// convertJSIToMP, the batch delivery shape onDataFromGo hands to rpcOnJs, and
// packAndSend's framing.
//
// Everything runs against a real Hermes runtime through the public API --
// frames go in via onDataFromGo and values come back out through the rpcOnGo
// the bridge installs -- so what is exercised is what the app actually does.
// Build and run with scripts/test-jsi-convert.sh.
//
// react-native-kb.cpp is #included rather than linked: packNumber lives in an
// anonymous namespace, and pulling the translation unit in is the only way to
// reach it without changing production code purely for the tests' benefit.
// Nothing else in here depends on that; the rest goes through the header's
// public surface.
#include "../react-native-kb.cpp" // IWYU pragma: keep

#include "../frame-parser.h"
#include "frame-builder.h"
#include "test-harness.h"

#include <hermes/hermes.h>

#include <cmath>
#include <cstdint>
#include <cstring>
#include <memory>
#include <random>
#include <string>
#include <vector>

using kbtest::Bytes;

namespace {

// ---------------------------------------------------------------------------
// packNumber
// ---------------------------------------------------------------------------

// The formulation packNumber replaced (commit 4b3d2120e2), kept verbatim as
// the oracle for the random sweep: obviously correct, but goes through libm.
void packNumberReference(msgpack::packer<msgpack::sbuffer> &pk, double d) {
  if (d == std::floor(d) && std::isfinite(d)) {
    if (d >= 0 && d < 18446744073709551616.0) {
      pk.pack(static_cast<uint64_t>(d));
    } else if (d < 0 && d >= -9223372036854775808.0) {
      pk.pack(static_cast<int64_t>(d));
    } else {
      pk.pack(d);
    }
  } else {
    pk.pack(d);
  }
}

Bytes packWith(void (*fn)(msgpack::packer<msgpack::sbuffer> &, double),
               double d) {
  msgpack::sbuffer buf;
  msgpack::packer<msgpack::sbuffer> pk(&buf);
  fn(pk, d);
  return kbtest::sbufferToBytes(buf);
}

Bytes packNum(double d) { return packWith(&kb::packNumber, d); }

msgpack::object_handle unpackBytes(const Bytes &b) {
  return msgpack::unpack(reinterpret_cast<const char *>(b.data()), b.size());
}

std::string hex(const Bytes &b) {
  static const char *digits = "0123456789abcdef";
  std::string out;
  for (uint8_t c : b) {
    out += digits[c >> 4];
    out += digits[c & 0xf];
  }
  return out;
}

// Human-readable double, exact enough to identify which value failed.
std::string dstr(double d) {
  char buf[64];
  snprintf(buf, sizeof(buf), "%.17g", d);
  return buf;
}

enum class Want { Uint, Int, Float };

const char *wantName(Want w) {
  switch (w) {
  case Want::Uint:
    return "POSITIVE_INTEGER";
  case Want::Int:
    return "NEGATIVE_INTEGER";
  default:
    return "FLOAT";
  }
}

// Asserts the msgpack type packNumber chose, and that the packed value still
// means what the double meant: exact integer equality for the integer
// encodings, bit equality for the float fallback (so NaN payloads and -0.0 are
// checked, not glossed over by ==).
void expectPacked(double d, Want want, int64_t asInt = 0) {
  auto bytes = packNum(d);
  auto oh = unpackBytes(bytes);
  const auto &o = oh.get();
  const std::string where = "packNumber(" + dstr(d) + ") -> " + hex(bytes);

  switch (want) {
  case Want::Uint:
    CHECK_MSG(o.type == msgpack::type::POSITIVE_INTEGER,
              where + ": expected POSITIVE_INTEGER, got type " +
                  std::to_string(int(o.type)));
    CHECK_MSG(o.as<uint64_t>() == static_cast<uint64_t>(asInt),
              where + ": value " + std::to_string(o.as<uint64_t>()) +
                  " != " + std::to_string(static_cast<uint64_t>(asInt)));
    break;
  case Want::Int:
    CHECK_MSG(o.type == msgpack::type::NEGATIVE_INTEGER,
              where + ": expected NEGATIVE_INTEGER, got type " +
                  std::to_string(int(o.type)));
    CHECK_MSG(o.as<int64_t>() == asInt,
              where + ": value " + std::to_string(o.as<int64_t>()) +
                  " != " + std::to_string(asInt));
    break;
  case Want::Float: {
    CHECK_MSG(o.type == msgpack::type::FLOAT64 ||
                  o.type == msgpack::type::FLOAT32,
              where + ": expected FLOAT, got type " +
                  std::to_string(int(o.type)));
    double got = o.as<double>();
    CHECK_MSG(std::memcmp(&got, &d, sizeof(double)) == 0,
              where + ": float payload " + dstr(got) + " != " + dstr(d));
    break;
  }
  }
}

// Also assert the encoding matches the old formulation byte for byte -- the
// table is the interesting half of that comparison, so run both.
void expectMatchesReference(double d) {
  auto a = packNum(d);
  auto b = packWith(&packNumberReference, d);
  CHECK_MSG(a == b, "packNumber(" + dstr(d) + ") = " + hex(a) +
                        " but reference = " + hex(b));
}

constexpr double kInf = std::numeric_limits<double>::infinity();
constexpr double k2p53 = 9007199254740992.0;             // 2^53
constexpr double k2p63 = 9223372036854775808.0;          // 2^63
constexpr double k2p64 = 18446744073709551616.0;         // 2^64

void testPackNumberTable() {
  struct Row {
    double d;
    Want want;
    int64_t asInt;
    const char *name;
  };

  // 2^53+1 is not representable; the nearest double above 2^53 is 2^53+2.
  // 2^63-1 is not representable either; nextafter(2^63, 0) is 2^63 - 1024.
  const double justUnder2p63 = std::nextafter(k2p63, 0.0);
  const double justUnder2p64 = std::nextafter(k2p64, 0.0);
  const double justOver2p64 = std::nextafter(k2p64, kInf);
  const double justBelowNeg2p63 = std::nextafter(-k2p63, -kInf);
  const double justAboveNeg2p63 = std::nextafter(-k2p63, 0.0);

  const Row rows[] = {
      {0.0, Want::Uint, 0, "0"},
      // -0.0 >= 0 is true, so it takes the unsigned path and lands on uint 0.
      {-0.0, Want::Uint, 0, "-0"},
      {1.0, Want::Uint, 1, "1"},
      {-1.0, Want::Int, -1, "-1"},
      {k2p53 - 1, Want::Uint, 9007199254740991LL, "2^53-1"},
      {k2p53, Want::Uint, 9007199254740992LL, "2^53"},
      {k2p53 + 2, Want::Uint, 9007199254740994LL, "2^53+2 (2^53+1 unrepr.)"},
      {-k2p53, Want::Int, -9007199254740992LL, "-2^53"},
      {justUnder2p63, Want::Uint, 9223372036854774784LL, "nextafter(2^63,0)"},
      // 2^63 itself is < 2^64 so it packs as an unsigned, not as a negative.
      {k2p63, Want::Uint, static_cast<int64_t>(9223372036854775808ULL), "2^63"},
      {justAboveNeg2p63, Want::Int, -9223372036854774784LL,
       "nextafter(-2^63,0)"},
      {-k2p63, Want::Int, INT64_MIN, "-2^63"},
      // The whole point of the `<` in `d < 2^64`: one ulp lower is the largest
      // double that still fits a uint64, 2^64 itself must not be cast.
      {justUnder2p64, Want::Uint,
       static_cast<int64_t>(18446744073709549568ULL), "nextafter(2^64,0)"},
      {k2p64, Want::Float, 0, "2^64"},
      {justOver2p64, Want::Float, 0, "nextafter(2^64,inf)"},
      {justBelowNeg2p63, Want::Float, 0, "nextafter(-2^63,-inf)"},
      {std::numeric_limits<double>::infinity(), Want::Float, 0, "+inf"},
      {-std::numeric_limits<double>::infinity(), Want::Float, 0, "-inf"},
      {std::numeric_limits<double>::quiet_NaN(), Want::Float, 0, "NaN"},
      {0.5, Want::Float, 0, "0.5"},
      {-0.5, Want::Float, 0, "-0.5"},
      {1.5, Want::Float, 0, "1.5"},
      {-1.5, Want::Float, 0, "-1.5"},
      {1e300, Want::Float, 0, "1e300"},
      {-1e300, Want::Float, 0, "-1e300"},
      {std::numeric_limits<double>::denorm_min(), Want::Float, 0, "denorm_min"},
      {-std::numeric_limits<double>::denorm_min(), Want::Float, 0,
       "-denorm_min"},
      {std::numeric_limits<double>::max(), Want::Float, 0, "DBL_MAX"},
      {std::numeric_limits<double>::lowest(), Want::Float, 0, "-DBL_MAX"},
  };

  for (const auto &r : rows) {
    try {
      expectPacked(r.d, r.want, r.asInt);
      expectMatchesReference(r.d);
    } catch (const kbtest::CheckFailed &e) {
      throw kbtest::CheckFailed(std::string("[") + r.name + " expected " +
                                wantName(r.want) + "] " + e.message);
    }
  }
}

// A dense ulp-level walk around every constant the range checks compare
// against -- this is where a `<` vs `<=` slip lives.
void testPackNumberBoundaryNeighborhoods() {
  const double anchors[] = {0.0,   -0.0,  1.0,   -1.0,  k2p53,
                            -k2p53, k2p63, -k2p63, k2p64, -k2p64};
  for (double anchor : anchors) {
    double up = anchor;
    double down = anchor;
    for (int i = 0; i < 8; ++i) {
      expectMatchesReference(up);
      expectMatchesReference(down);
      up = std::nextafter(up, kInf);
      down = std::nextafter(down, -kInf);
    }
  }
}

// Fixed seed, stated here so a failure is reproducible: 0xC0FFEE12345678ULL.
constexpr uint64_t kSweepSeed = 0xC0FFEE12345678ULL;
constexpr int kSweepCount = 1000000;

void testPackNumberRandomSweep() {
  std::mt19937_64 rng(kSweepSeed);
  size_t mismatches = 0;
  std::string firstMismatch;

  for (int i = 0; i < kSweepCount; ++i) {
    uint64_t bits = rng();
    double d;
    switch (i % 5) {
    case 0: {
      // Arbitrary bit patterns: hits NaNs, infinities, denormals, huge
      // magnitudes, non-integral values.
      std::memcpy(&d, &bits, sizeof(d));
      break;
    }
    case 1:
      // Exactly representable integers across the whole uint64 range.
      d = static_cast<double>(bits);
      break;
    case 2:
      d = static_cast<double>(static_cast<int64_t>(bits));
      break;
    case 3:
      // Straddles 2^53, where doubles stop representing every integer.
      d = static_cast<double>(static_cast<int64_t>(bits % (1ULL << 55))) -
          (1LL << 54);
      break;
    default:
      // Small non-integral values.
      d = static_cast<double>(static_cast<int64_t>(bits % 100000)) /
          static_cast<double>(1 + (bits >> 40));
      break;
    }

    auto got = packNum(d);
    auto want = packWith(&packNumberReference, d);
    if (got != want) {
      if (mismatches++ == 0) {
        firstMismatch = "i=" + std::to_string(i) + " d=" + dstr(d) + " got " +
                        hex(got) + " want " + hex(want);
      }
    }
  }

  CHECK_MSG(mismatches == 0,
            "random sweep (seed 0xC0FFEE12345678, " +
                std::to_string(kSweepCount) + " doubles): " +
                std::to_string(mismatches) + " mismatches, first: " +
                firstMismatch);
}

// ---------------------------------------------------------------------------
// Hermes harness
// ---------------------------------------------------------------------------

// The bridge only schedules work meant for the JS thread and these tests are
// single threaded, so running inline is faithful and keeps assertions
// synchronous with the onDataFromGo call that produced them.
class InlineCallInvoker : public facebook::react::CallInvoker {
public:
  explicit InlineCallInvoker(jsi::Runtime &rt) : rt_(rt) {}
  void invokeAsync(facebook::react::CallFunc &&func) noexcept override {
    func(rt_);
  }
  void invokeSync(facebook::react::CallFunc &&func) override { func(rt_); }

private:
  jsi::Runtime &rt_;
};

struct Delivery {
  jsi::Value value;
  int count = 0;
};

struct Harness {
  // Declaration order is destruction order in reverse: the jsi::Values in
  // `deliveries` must die before the runtime does.
  std::unique_ptr<facebook::hermes::HermesRuntime> runtime;
  std::shared_ptr<kb::KBBridge> bridge;
  std::vector<Bytes> writes;
  std::vector<std::string> errors;
  std::vector<int64_t> fatals;
  std::vector<Delivery> deliveries;
  bool writeResult = true;

  Harness() {
    runtime = facebook::hermes::makeHermesRuntime();
    auto &rt = *runtime;
    bridge = std::make_shared<kb::KBBridge>();
    bridge->install(
        rt, std::make_shared<InlineCallInvoker>(rt),
        [this](void *ptr, size_t size) {
          const auto *p = static_cast<const uint8_t *>(ptr);
          writes.emplace_back(p, p + size);
          return writeResult;
        },
        [this](const std::string &msg) { errors.push_back(msg); },
        [this](int64_t epoch) { fatals.push_back(epoch); });
    installRpcOnJs();
  }

  jsi::Runtime &rt() { return *runtime; }

  void installRpcOnJs() {
    auto fn = jsi::Function::createFromHostFunction(
        rt(), jsi::PropNameID::forAscii(rt(), "rpcOnJs"), 2,
        [this](jsi::Runtime &r, const jsi::Value &, const jsi::Value *args,
               size_t argCount) -> jsi::Value {
          Delivery d;
          d.value = argCount > 0 ? jsi::Value(r, args[0])
                                 : jsi::Value::undefined();
          d.count = (argCount > 1 && args[1].isNumber())
                        ? int(args[1].asNumber())
                        : -1;
          deliveries.push_back(std::move(d));
          return jsi::Value::undefined();
        });
    rt().global().setProperty(rt(), "rpcOnJs", std::move(fn));
  }

  void feed(const Bytes &bytes, int64_t epoch = 1) {
    Bytes copy = bytes; // onDataFromGo takes a mutable pointer.
    bridge->onDataFromGo(copy.data(), int(copy.size()), epoch);
  }

  // jsi::JSError owns a shared_ptr<jsi::Value>, so one escaping a test would
  // be destroyed after this Harness (and its runtime) is gone -- a crash, not
  // a failure. Every entry point that can throw one converts it here, while
  // the runtime is still alive.
  jsi::Value eval(const std::string &src) {
    try {
      return rt().evaluateJavaScript(
          std::make_shared<jsi::StringBuffer>("(" + src + ")"), "test.js");
    } catch (const jsi::JSError &e) {
      throw kbtest::CheckFailed("JS threw while evaluating: " + e.getMessage());
    }
  }

  // Runs `src`, hands the resulting value to the installed rpcOnGo.
  jsi::Value send(const std::string &src) {
    auto value = eval(src);
    try {
      return rt().global().getPropertyAsFunction(rt(), "rpcOnGo").call(rt(),
                                                                      value);
    } catch (const jsi::JSError &e) {
      throw kbtest::CheckFailed("rpcOnGo threw: " + e.getMessage());
    }
  }

  // Returns the exception message if the send threw, empty otherwise.
  std::string sendExpectingThrow(const std::string &src) {
    try {
      send(src);
    } catch (const jsi::JSError &e) {
      return e.getMessage();
    } catch (const std::exception &e) {
      return e.what();
    }
    return {};
  }

  // The msgpack payload of the last frame written, header stripped, with the
  // header itself checked against the encoding frame-builder.h describes.
  msgpack::object_handle lastPayload() {
    CHECK(!writes.empty());
    const auto &w = writes.back();
    CHECK(w.size() >= 5);
    auto expectedHeader =
        kbtest::packHeaderUint32(static_cast<uint32_t>(w.size() - 5));
    Bytes actualHeader(w.begin(), w.begin() + 5);
    CHECK_MSG(actualHeader == expectedHeader,
              "frame header " + hex(actualHeader) + " != packHeaderUint32(" +
                  std::to_string(w.size() - 5) + ") = " + hex(expectedHeader));
    return msgpack::unpack(reinterpret_cast<const char *>(w.data()) + 5,
                           w.size() - 5);
  }
};

Bytes frameOf(const std::function<void(msgpack::packer<msgpack::sbuffer> &)>
                  &fn) {
  return kbtest::buildFrameProdHeader(kbtest::packContent(fn));
}

Bytes concatFrames(const std::vector<Bytes> &frames) {
  Bytes out;
  for (const auto &f : frames) {
    out.insert(out.end(), f.begin(), f.end());
  }
  return out;
}

// A frame that decodes fine as msgpack but fails convertMPToJSI: an array is
// not a valid map key, so mpToString throws.
Bytes badKeyFrame() {
  return frameOf([](auto &pk) {
    pk.pack_map(1);
    pk.pack_array(0);
    pk.pack(1);
  });
}

Bytes markerFrame(int id) {
  return frameOf([id](auto &pk) {
    pk.pack_map(1);
    pk.pack(std::string("id"));
    pk.pack(id);
  });
}

int markerId(jsi::Runtime &rt, const jsi::Value &v) {
  CHECK(v.isObject());
  auto prop = v.getObject(rt).getProperty(rt, "id");
  CHECK(prop.isNumber());
  return int(prop.asNumber());
}

bool isTypedArray(jsi::Runtime &rt, const jsi::Value &v) {
  if (!v.isObject()) {
    return false;
  }
  auto isView = rt.global()
                    .getPropertyAsObject(rt, "ArrayBuffer")
                    .getPropertyAsFunction(rt, "isView");
  auto res = isView.call(rt, jsi::Value(rt, v.getObject(rt)));
  return res.isBool() && res.getBool();
}

std::string ctorName(jsi::Runtime &rt, const jsi::Value &v) {
  return v.getObject(rt)
      .getPropertyAsObject(rt, "constructor")
      .getProperty(rt, "name")
      .getString(rt)
      .utf8(rt);
}

Bytes typedArrayBytes(jsi::Runtime &rt, const jsi::Value &v) {
  auto obj = v.getObject(rt);
  size_t len = size_t(obj.getProperty(rt, "length").asNumber());
  Bytes out;
  out.reserve(len);
  for (size_t i = 0; i < len; ++i) {
    out.push_back(
        uint8_t(obj.getProperty(rt, std::to_string(i).c_str()).asNumber()));
  }
  return out;
}

std::string mpBinToString(const msgpack::object &o) {
  CHECK(o.type == msgpack::type::BIN);
  return std::string(o.via.bin.ptr, o.via.bin.size);
}

// ---------------------------------------------------------------------------
// msgpack -> JSI
// ---------------------------------------------------------------------------

void testDecodeBinBecomesUint8Array() {
  Harness h;
  const std::string payload("\x00\x01\xfe\xff", 4);
  h.feed(frameOf([&](auto &pk) {
    pk.pack_map(1);
    pk.pack(std::string("b"));
    pk.pack_bin(uint32_t(payload.size()));
    pk.pack_bin_body(payload.data(), uint32_t(payload.size()));
  }));

  CHECK_EQ(h.deliveries.size(), size_t(1));
  auto bin = h.deliveries[0].value.getObject(h.rt()).getProperty(h.rt(), "b");
  CHECK_MSG(isTypedArray(h.rt(), bin), "BIN did not decode to an ArrayBuffer view");
  CHECK_MSG(ctorName(h.rt(), bin) == "Uint8Array",
            "BIN decoded to " + ctorName(h.rt(), bin) + ", want Uint8Array");
  Bytes want{0x00, 0x01, 0xfe, 0xff};
  CHECK_MSG(typedArrayBytes(h.rt(), bin) == want, "Uint8Array contents differ");
  CHECK_EQ(h.errors.size(), size_t(0));
}

void testDecodeStrIsNotBin() {
  Harness h;
  h.feed(frameOf([](auto &pk) {
    pk.pack_map(2);
    pk.pack(std::string("s"));
    pk.pack(std::string("hi"));
    pk.pack(std::string("b"));
    pk.pack_bin(2);
    pk.pack_bin_body("hi", 2);
  }));

  CHECK_EQ(h.deliveries.size(), size_t(1));
  auto obj = h.deliveries[0].value.getObject(h.rt());
  auto s = obj.getProperty(h.rt(), "s");
  auto b = obj.getProperty(h.rt(), "b");
  CHECK_MSG(s.isString(), "STR did not decode to a JS string");
  CHECK_MSG(s.getString(h.rt()).utf8(h.rt()) == "hi", "STR contents differ");
  CHECK_MSG(isTypedArray(h.rt(), b), "BIN with identical bytes decoded as a string");
}

void testDecodeUtf8Strings() {
  Harness h;
  // Multibyte (2/3/4 byte sequences) plus an embedded NUL, which msgpack
  // carries fine but a NUL-terminated path would truncate.
  const std::string multi = "caf\xc3\xa9 \xe2\x9c\x93 \xf0\x9f\x94\x91";
  const std::string withNul = std::string("a\0b", 3);
  h.feed(frameOf([&](auto &pk) {
    pk.pack_map(3);
    pk.pack(std::string("m"));
    pk.pack(multi);
    pk.pack(std::string("n"));
    pk.pack(withNul);
    pk.pack(std::string("e"));
    pk.pack(std::string());
  }));

  CHECK_EQ(h.deliveries.size(), size_t(1));
  auto obj = h.deliveries[0].value.getObject(h.rt());
  auto got = obj.getProperty(h.rt(), "m").getString(h.rt()).utf8(h.rt());
  CHECK_MSG(got == multi, "multibyte UTF-8 round trip differs: " + hex(Bytes(got.begin(), got.end())));
  auto nul = obj.getProperty(h.rt(), "n").getString(h.rt());
  CHECK_EQ(size_t(nul.length(h.rt())), size_t(3));
  auto nulUtf8 = nul.utf8(h.rt());
  CHECK_MSG(nulUtf8 == withNul, "embedded NUL string round trip differs");
  auto empty = obj.getProperty(h.rt(), "e");
  CHECK_MSG(empty.isString() && empty.getString(h.rt()).utf8(h.rt()).empty(),
            "empty string did not round trip");
}

void testDecodeEmptyContainers() {
  Harness h;
  h.feed(frameOf([](auto &pk) {
    pk.pack_map(4);
    pk.pack(std::string("arr"));
    pk.pack_array(0);
    pk.pack(std::string("map"));
    pk.pack_map(0);
    pk.pack(std::string("str"));
    pk.pack(std::string());
    pk.pack(std::string("bin"));
    pk.pack_bin(0);
    pk.pack_bin_body("", 0);
  }));

  CHECK_EQ(h.deliveries.size(), size_t(1));
  auto obj = h.deliveries[0].value.getObject(h.rt());
  auto arr = obj.getProperty(h.rt(), "arr");
  CHECK_MSG(arr.isObject() && arr.getObject(h.rt()).isArray(h.rt()),
            "empty array did not decode to an Array");
  CHECK_EQ(arr.getObject(h.rt()).getArray(h.rt()).size(h.rt()), size_t(0));
  auto map = obj.getProperty(h.rt(), "map");
  CHECK_MSG(map.isObject() && !map.getObject(h.rt()).isArray(h.rt()),
            "empty map did not decode to an Object");
  CHECK_EQ(map.getObject(h.rt()).getPropertyNames(h.rt()).size(h.rt()),
           size_t(0));
  auto bin = obj.getProperty(h.rt(), "bin");
  CHECK_MSG(isTypedArray(h.rt(), bin), "empty BIN did not decode to a Uint8Array");
  CHECK_EQ(size_t(bin.getObject(h.rt()).getProperty(h.rt(), "length").asNumber()),
           size_t(0));
  CHECK_EQ(h.errors.size(), size_t(0));
}

void testDecodeExtBecomesUndefined() {
  Harness h;
  h.feed(frameOf([](auto &pk) {
    pk.pack_map(1);
    pk.pack(std::string("x"));
    pk.pack_ext(4, 7);
    pk.pack_ext_body("abcd", 4);
  }));

  CHECK_EQ(h.deliveries.size(), size_t(1));
  CHECK_EQ(h.errors.size(), size_t(0));
  auto obj = h.deliveries[0].value.getObject(h.rt());
  CHECK_MSG(obj.getProperty(h.rt(), "x").isUndefined(),
            "EXT did not decode to undefined");
  // The key must still exist -- an EXT value must not silently drop its key.
  CHECK_EQ(obj.getPropertyNames(h.rt()).size(h.rt()), size_t(1));
}

void testDecodeNonScalarMapKeyThrows() {
  Harness h;
  h.feed(badKeyFrame(), 42);

  CHECK_EQ(h.deliveries.size(), size_t(0));
  CHECK_EQ(h.errors.size(), size_t(1));
  CHECK_MSG(h.errors[0].find("Invalid map key") != std::string::npos,
            "unexpected error: " + h.errors[0]);
  CHECK_EQ(h.fatals.size(), size_t(1));
  CHECK_EQ(h.fatals[0], int64_t(42));
}

void testDecodeScalarMapKeysCoerce() {
  Harness h;
  h.feed(frameOf([](auto &pk) {
    pk.pack_map(3);
    pk.pack(7);
    pk.pack(std::string("pos"));
    pk.pack(-7);
    pk.pack(std::string("neg"));
    pk.pack(true);
    pk.pack(std::string("bool"));
  }));

  // BOOLEAN is not one of mpToString's accepted key types, so this frame is
  // expected to be rejected exactly like the array-key case.
  CHECK_EQ(h.deliveries.size(), size_t(0));
  CHECK_EQ(h.errors.size(), size_t(1));

  Harness h2;
  h2.feed(frameOf([](auto &pk) {
    pk.pack_map(2);
    pk.pack(7);
    pk.pack(std::string("pos"));
    pk.pack(-7);
    pk.pack(std::string("neg"));
  }));
  CHECK_EQ(h2.deliveries.size(), size_t(1));
  auto obj = h2.deliveries[0].value.getObject(h2.rt());
  CHECK_MSG(obj.getProperty(h2.rt(), "7").getString(h2.rt()).utf8(h2.rt()) ==
                "pos",
            "positive integer key did not stringify");
  CHECK_MSG(obj.getProperty(h2.rt(), "-7").getString(h2.rt()).utf8(h2.rt()) ==
                "neg",
            "negative integer key did not stringify");
}

// convertMPToJSI pushes a frame per container and throws once the stack would
// exceed kMaxDepth, so the 1024th nested container is the last one accepted.
void testDecodeDepthLimit() {
  {
    Harness h;
    h.feed(kbtest::buildFrameProdHeader(kbtest::contentNested(1024)));
    CHECK_MSG(h.errors.empty(),
              "depth 1024 should decode, got: " +
                  (h.errors.empty() ? std::string() : h.errors[0]));
    CHECK_EQ(h.deliveries.size(), size_t(1));
  }
  {
    Harness h;
    h.feed(kbtest::buildFrameProdHeader(kbtest::contentNested(1023)));
    CHECK(h.errors.empty());
    CHECK_EQ(h.deliveries.size(), size_t(1));
  }
  {
    Harness h;
    h.feed(kbtest::buildFrameProdHeader(kbtest::contentNested(1025)), 9);
    CHECK_EQ(h.deliveries.size(), size_t(0));
    CHECK_EQ(h.errors.size(), size_t(1));
    CHECK_MSG(h.errors[0].find("nesting too deep") != std::string::npos,
              "unexpected error: " + h.errors[0]);
    CHECK_EQ(h.fatals.size(), size_t(1));
    CHECK_EQ(h.fatals[0], int64_t(9));
  }
}

// ---------------------------------------------------------------------------
// JSI -> msgpack
// ---------------------------------------------------------------------------

void testEncodeSymbolAndBigIntBecomeNil() {
  Harness h;
  const bool hasBigInt =
      h.eval("typeof BigInt === 'function'").getBool();
  const std::string src =
      hasBigInt ? "{a: 1, s: Symbol('x'), g: BigInt(7), d: 4}"
                : "{a: 1, s: Symbol('x'), g: null, d: 4}";
  h.send(src);

  auto oh = h.lastPayload();
  const auto &o = oh.get();
  CHECK_MSG(o.type == msgpack::type::MAP, "expected a MAP");
  // The enclosing map header promised 4 entries; the whole point of packing
  // nil is that all 4 are actually present and the frame still parses.
  CHECK_EQ(o.via.map.size, uint32_t(4));
  auto valueFor = [&](const char *key) -> const msgpack::object & {
    for (uint32_t i = 0; i < o.via.map.size; ++i) {
      const auto &k = o.via.map.ptr[i].key;
      if (k.type == msgpack::type::STR &&
          std::string(k.via.str.ptr, k.via.str.size) == key) {
        return o.via.map.ptr[i].val;
      }
    }
    throw kbtest::CheckFailed(std::string("missing key ") + key);
  };
  CHECK_EQ(valueFor("a").as<int>(), 1);
  CHECK_MSG(valueFor("s").type == msgpack::type::NIL, "Symbol did not pack nil");
  if (hasBigInt) {
    CHECK_MSG(valueFor("g").type == msgpack::type::NIL,
              "BigInt did not pack nil");
  }
  CHECK_EQ(valueFor("d").as<int>(), 4);
}

void testEncodeFunctionBecomesNil() {
  Harness h;
  h.send("{f: function () {}, a: 1}");
  auto oh = h.lastPayload();
  const auto &o = oh.get();
  CHECK_EQ(o.via.map.size, uint32_t(2));
  CHECK_MSG(o.via.map.ptr[0].val.type == msgpack::type::NIL,
            "function did not pack nil");
}

// Replaces a "first key is a digit" heuristic: a plain object that happens to
// carry byteLength/buffer and a "0" first key must still pack as a map.
void testEncodeIsViewNotDigitHeuristic() {
  Harness h;
  h.send("(function () {"
         "  const o = {};"
         "  o['0'] = 7;"
         "  o.byteLength = 2;"
         "  o.buffer = new ArrayBuffer(2);"
         "  return o;"
         "})()");
  auto oh = h.lastPayload();
  const auto &o = oh.get();
  CHECK_MSG(o.type == msgpack::type::MAP,
            "plain object with a '0' first key packed as type " +
                std::to_string(int(o.type)) + ", want MAP");
  CHECK_EQ(o.via.map.size, uint32_t(3));

  // And an object with a digit first key and nothing typed-array-ish at all.
  Harness h2;
  h2.send("{'0': 'a', '1': 'b'}");
  auto oh2 = h2.lastPayload();
  CHECK_MSG(oh2.get().type == msgpack::type::MAP, "digit-keyed object is not binary");
  CHECK_EQ(oh2.get().via.map.size, uint32_t(2));
}

void testEncodeTypedArrayViews() {
  Harness h;
  // A 4-byte window into a 10-byte buffer: only bytes 3..6 may be packed.
  h.send("(function () {"
         "  const b = new ArrayBuffer(10);"
         "  const full = new Uint8Array(b);"
         "  for (let i = 0; i < 10; i++) full[i] = i;"
         "  return new Uint8Array(b, 3, 4);"
         "})()");
  auto oh = h.lastPayload();
  CHECK_MSG(oh.get().type == msgpack::type::BIN, "typed array did not pack as BIN");
  CHECK_MSG(mpBinToString(oh.get()) == std::string("\x03\x04\x05\x06", 4),
            "subrange view packed the wrong bytes");

  // DataView takes the same path via ArrayBuffer.isView.
  Harness h2;
  h2.send("(function () {"
          "  const b = new ArrayBuffer(10);"
          "  const full = new Uint8Array(b);"
          "  for (let i = 0; i < 10; i++) full[i] = i;"
          "  return new DataView(b, 2, 3);"
          "})()");
  auto oh2 = h2.lastPayload();
  CHECK_MSG(oh2.get().type == msgpack::type::BIN, "DataView did not pack as BIN");
  CHECK_MSG(mpBinToString(oh2.get()) == std::string("\x02\x03\x04", 3),
            "DataView subrange packed the wrong bytes");

  // A multi-byte-element view: byteLength/byteOffset are in bytes, not
  // elements, so a Uint32Array over a subrange must pack byteLength bytes.
  Harness h3;
  h3.send("(function () {"
          "  const b = new ArrayBuffer(16);"
          "  const full = new Uint8Array(b);"
          "  for (let i = 0; i < 16; i++) full[i] = i;"
          "  return new Uint32Array(b, 4, 2);"
          "})()");
  auto oh3 = h3.lastPayload();
  CHECK_MSG(oh3.get().type == msgpack::type::BIN, "Uint32Array did not pack as BIN");
  CHECK_MSG(mpBinToString(oh3.get()) ==
                std::string("\x04\x05\x06\x07\x08\x09\x0a\x0b", 8),
            "Uint32Array subrange packed the wrong bytes");

  // A bare ArrayBuffer (not a view) packs its whole contents.
  Harness h4;
  h4.send("(function () {"
          "  const b = new ArrayBuffer(3);"
          "  new Uint8Array(b).set([9, 8, 7]);"
          "  return b;"
          "})()");
  auto oh4 = h4.lastPayload();
  CHECK_MSG(oh4.get().type == msgpack::type::BIN, "ArrayBuffer did not pack as BIN");
  CHECK_MSG(mpBinToString(oh4.get()) == std::string("\x09\x08\x07", 3),
            "ArrayBuffer packed the wrong bytes");
}

void testEncodeEmptyContainers() {
  Harness h;
  h.send("{arr: [], map: {}, str: '', bin: new Uint8Array(0)}");
  auto oh = h.lastPayload();
  const auto &o = oh.get();
  CHECK_EQ(o.via.map.size, uint32_t(4));
  CHECK_MSG(o.via.map.ptr[0].val.type == msgpack::type::ARRAY, "want ARRAY");
  CHECK_EQ(o.via.map.ptr[0].val.via.array.size, uint32_t(0));
  CHECK_MSG(o.via.map.ptr[1].val.type == msgpack::type::MAP, "want MAP");
  CHECK_EQ(o.via.map.ptr[1].val.via.map.size, uint32_t(0));
  CHECK_MSG(o.via.map.ptr[2].val.type == msgpack::type::STR, "want STR");
  CHECK_EQ(o.via.map.ptr[2].val.via.str.size, uint32_t(0));
  CHECK_MSG(o.via.map.ptr[3].val.type == msgpack::type::BIN, "want BIN");
  CHECK_EQ(o.via.map.ptr[3].val.via.bin.size, uint32_t(0));
}

void testEncodeUtf8Strings() {
  Harness h;
  h.send("{m: 'caf\\u00e9 \\u2713 \\ud83d\\udd11', n: 'a\\u0000b'}");
  auto oh = h.lastPayload();
  const auto &o = oh.get();
  const auto &m = o.via.map.ptr[0].val;
  CHECK_MSG(m.type == msgpack::type::STR, "want STR");
  CHECK_MSG(std::string(m.via.str.ptr, m.via.str.size) ==
                "caf\xc3\xa9 \xe2\x9c\x93 \xf0\x9f\x94\x91",
            "multibyte string packed wrong bytes");
  const auto &n = o.via.map.ptr[1].val;
  CHECK_EQ(n.via.str.size, uint32_t(3));
  CHECK_MSG(std::string(n.via.str.ptr, n.via.str.size) ==
                std::string("a\0b", 3),
            "embedded NUL string packed wrong bytes");
}

void testEncodeDepthLimit() {
  Harness h;
  h.send("(function () { let a = 42; for (let i = 0; i < 1024; i++) a = [a]; "
         "return a; })()");
  CHECK_EQ(h.writes.size(), size_t(1));

  auto msg = h.sendExpectingThrow(
      "(function () { let a = 42; for (let i = 0; i < 1025; i++) a = [a]; "
      "return a; })()");
  CHECK_MSG(msg.find("nesting too deep") != std::string::npos,
            "expected a nesting error, got: " + msg);
}

// Round-trips every scalar type back out through rpcOnGo, so decode and
// encode are checked against each other rather than each against itself.
void testRoundTripThroughBothDirections() {
  Harness h;
  const std::string bin("\x01\x02\x03", 3);
  h.feed(frameOf([&](auto &pk) {
    pk.pack_map(7);
    pk.pack(std::string("i"));
    pk.pack(42);
    pk.pack(std::string("ni"));
    pk.pack(-42);
    pk.pack(std::string("f"));
    pk.pack(1.5);
    pk.pack(std::string("b"));
    pk.pack(true);
    pk.pack(std::string("n"));
    pk.pack_nil();
    pk.pack(std::string("s"));
    pk.pack(std::string("hello"));
    pk.pack(std::string("bin"));
    pk.pack_bin(3);
    pk.pack_bin_body(bin.data(), 3);
  }));
  CHECK_EQ(h.deliveries.size(), size_t(1));

  auto rpcOnGo = h.rt().global().getPropertyAsFunction(h.rt(), "rpcOnGo");
  rpcOnGo.call(h.rt(), h.deliveries[0].value);

  auto oh = h.lastPayload();
  const auto &o = oh.get();
  CHECK_EQ(o.via.map.size, uint32_t(7));
  auto get = [&](const char *key) -> const msgpack::object & {
    for (uint32_t i = 0; i < o.via.map.size; ++i) {
      const auto &k = o.via.map.ptr[i].key;
      if (std::string(k.via.str.ptr, k.via.str.size) == key) {
        return o.via.map.ptr[i].val;
      }
    }
    throw kbtest::CheckFailed(std::string("missing key ") + key);
  };
  CHECK_EQ(get("i").as<int64_t>(), int64_t(42));
  CHECK_MSG(get("i").type == msgpack::type::POSITIVE_INTEGER,
            "42 did not repack as an unsigned integer");
  CHECK_EQ(get("ni").as<int64_t>(), int64_t(-42));
  CHECK_MSG(get("ni").type == msgpack::type::NEGATIVE_INTEGER,
            "-42 did not repack as a signed integer");
  CHECK_MSG(get("f").as<double>() == 1.5, "1.5 did not survive");
  CHECK_MSG(get("f").type == msgpack::type::FLOAT64, "1.5 did not stay a float");
  CHECK_MSG(get("b").as<bool>(), "true did not survive");
  CHECK_MSG(get("n").type == msgpack::type::NIL, "nil did not survive");
  CHECK_MSG(get("s").as<std::string>() == "hello", "string did not survive");
  CHECK_MSG(get("bin").type == msgpack::type::BIN, "BIN did not survive as BIN");
  CHECK_MSG(mpBinToString(get("bin")) == bin, "BIN contents differ");
}

// ---------------------------------------------------------------------------
// Batch delivery shape
// ---------------------------------------------------------------------------

void testSingleFrameDeliversBareValue() {
  Harness h;
  h.feed(markerFrame(1));
  CHECK_EQ(h.deliveries.size(), size_t(1));
  CHECK_EQ(h.deliveries[0].count, 1);
  CHECK_MSG(!h.deliveries[0].value.getObject(h.rt()).isArray(h.rt()),
            "a single message was wrapped in an array");
  CHECK_EQ(markerId(h.rt(), h.deliveries[0].value), 1);
}

void testMultiFrameDeliversArray() {
  Harness h;
  h.feed(concatFrames({markerFrame(1), markerFrame(2), markerFrame(3)}));
  CHECK_EQ(h.deliveries.size(), size_t(1));
  CHECK_EQ(h.deliveries[0].count, 3);
  auto arr = h.deliveries[0].value.getObject(h.rt()).getArray(h.rt());
  CHECK_EQ(arr.size(h.rt()), size_t(3));
  for (int i = 0; i < 3; ++i) {
    CHECK_EQ(markerId(h.rt(), arr.getValueAtIndex(h.rt(), size_t(i))), i + 1);
  }
}

// JS's rpcOnJs only unwraps the array when count > 1, so when a batch is
// whittled down to one survivor it must go out bare or JS hands the wrapper
// itself to isRPCMessage and drops it.
void testBatchWithOneSurvivorDeliversBareValue() {
  Harness h;
  h.feed(concatFrames({markerFrame(7), badKeyFrame()}), 5);

  CHECK_EQ(h.deliveries.size(), size_t(1));
  CHECK_EQ(h.deliveries[0].count, 1);
  CHECK_MSG(h.deliveries[0].value.isObject(), "survivor is not an object");
  CHECK_MSG(!h.deliveries[0].value.getObject(h.rt()).isArray(h.rt()),
            "single survivor of a batch was delivered as a length-1 array");
  CHECK_EQ(markerId(h.rt(), h.deliveries[0].value), 7);
  CHECK_EQ(h.errors.size(), size_t(1));
  CHECK_MSG(h.errors[0].find("dropping undecodable message") !=
                std::string::npos,
            "unexpected error: " + h.errors[0]);
  // One bad message in the batch is not stream-fatal.
  CHECK_EQ(h.fatals.size(), size_t(0));
}

void testBatchWithAllBadEscalatesToFatal() {
  Harness h;
  h.feed(concatFrames({badKeyFrame(), badKeyFrame()}), 1234);

  CHECK_EQ(h.deliveries.size(), size_t(0));
  CHECK_EQ(h.errors.size(), size_t(3)); // two drops + the batch-level report
  CHECK_MSG(h.errors.back().find("dropped entire batch") != std::string::npos,
            "unexpected final error: " + h.errors.back());
  CHECK_MSG(h.errors.back().find("all 2 message(s)") != std::string::npos,
            "batch error lost the count: " + h.errors.back());
  CHECK_EQ(h.fatals.size(), size_t(1));
  CHECK_EQ(h.fatals[0], int64_t(1234));
}

void testOneBadMessageDropsAlone() {
  Harness h;
  h.feed(concatFrames(
      {markerFrame(1), badKeyFrame(), markerFrame(3), markerFrame(4)}));

  CHECK_EQ(h.deliveries.size(), size_t(1));
  CHECK_EQ(h.deliveries[0].count, 3);
  auto arr = h.deliveries[0].value.getObject(h.rt()).getArray(h.rt());
  // The array must be sized to what survived: a hole at the original index
  // would hand JS an undefined message to dispatch.
  CHECK_EQ(arr.size(h.rt()), size_t(3));
  CHECK_EQ(markerId(h.rt(), arr.getValueAtIndex(h.rt(), 0)), 1);
  CHECK_EQ(markerId(h.rt(), arr.getValueAtIndex(h.rt(), 1)), 3);
  CHECK_EQ(markerId(h.rt(), arr.getValueAtIndex(h.rt(), 2)), 4);
  CHECK_EQ(h.errors.size(), size_t(1));
  CHECK_EQ(h.fatals.size(), size_t(0));
}

void testMissingRpcOnJsIsFatal() {
  Harness h;
  h.rt().global().setProperty(h.rt(), "rpcOnJs", jsi::Value::undefined());
  h.feed(markerFrame(1), 99);
  CHECK_EQ(h.deliveries.size(), size_t(0));
  CHECK_EQ(h.fatals.size(), size_t(1));
  CHECK_EQ(h.fatals[0], int64_t(99));
}

// A framing violation is fatal on the reader thread, before anything is
// scheduled to JS.
void testFramingViolationIsFatal() {
  Harness h;
  auto bad = kbtest::buildFrameWithDeclaredSize(
      99, kbtest::packContent([](auto &pk) { pk.pack(1); }));
  h.feed(bad, 8);
  CHECK_EQ(h.deliveries.size(), size_t(0));
  CHECK_EQ(h.fatals.size(), size_t(1));
  CHECK_EQ(h.fatals[0], int64_t(8));
}

// ---------------------------------------------------------------------------
// packAndSend framing
// ---------------------------------------------------------------------------

void testSendFrameHeaderAndRoundTripThroughParser() {
  Harness h;
  h.send("{method: 'ping', seqid: 3, args: [1, 'two', null]}");
  CHECK_EQ(h.writes.size(), size_t(1));
  const auto &frame = h.writes[0];

  // Header bytes must be exactly what frame-builder.h's packHeaderUint32
  // produces (lastPayload asserts this) ...
  auto oh = h.lastPayload();
  CHECK_MSG(oh.get().type == msgpack::type::MAP, "payload is not a MAP");

  // ... and, more importantly, the real consumer must accept the real
  // producer's bytes, not a test re-implementation of them.
  kb::FrameParser parser;
  std::vector<msgpack::object_handle> out;
  Bytes copy = frame;
  parser.feed(copy.data(), copy.size(), out);
  CHECK_EQ(out.size(), size_t(1));
  CHECK_MSG(out[0].get().type == msgpack::type::MAP,
            "FrameParser decoded the wrong type from packAndSend's output");
  CHECK_EQ(out[0].get().via.map.size, uint32_t(3));

  // Byte-split every way to prove the header encoding survives partial reads.
  for (size_t split = 1; split < frame.size(); ++split) {
    kb::FrameParser p;
    std::vector<msgpack::object_handle> got;
    Bytes a(frame.begin(), frame.begin() + long(split));
    Bytes b(frame.begin() + long(split), frame.end());
    p.feed(a.data(), a.size(), got);
    p.feed(b.data(), b.size(), got);
    CHECK_MSG(got.size() == 1,
              "split at " + std::to_string(split) + " decoded " +
                  std::to_string(got.size()) + " frames");
  }
}

void testSendReturnsWriteResult() {
  Harness h;
  auto ok = h.send("{a: 1}");
  CHECK_MSG(ok.isBool() && ok.getBool(), "rpcOnGo did not return true");
  h.writeResult = false;
  auto bad = h.send("{a: 1}");
  CHECK_MSG(bad.isBool() && !bad.getBool(),
            "rpcOnGo did not propagate a failed write");
}

void testSendOversizeFrameThrows() {
  Harness h;
  // kMaxFrameSize is 64MiB; the bin32 header pushes this just past it.
  auto msg = h.sendExpectingThrow("new Uint8Array(64 * 1024 * 1024 + 16)");
  CHECK_MSG(msg.find("too large") != std::string::npos,
            "expected an oversize-frame error, got: " + msg);
  CHECK_EQ(h.writes.size(), size_t(0));
}

// The buffer release past kSendBufKeepCapacity swaps out the SendState while
// a reference to its sbuffer is still in scope, so the next send is the thing
// worth checking.
void testSendLargePayloadThenSmall() {
  Harness h;
  h.send("new Uint8Array(5 * 1024 * 1024)");
  CHECK_EQ(h.writes.size(), size_t(1));
  {
    auto oh = h.lastPayload();
    CHECK_MSG(oh.get().type == msgpack::type::BIN, "large payload is not BIN");
    CHECK_EQ(oh.get().via.bin.size, uint32_t(5 * 1024 * 1024));
  }

  h.send("{a: 1}");
  CHECK_EQ(h.writes.size(), size_t(2));
  auto oh = h.lastPayload();
  CHECK_MSG(oh.get().type == msgpack::type::MAP,
            "small frame after a buffer release is malformed");
  CHECK_EQ(oh.get().via.map.size, uint32_t(1));
}

// convertJSIToMP runs JS getters; one that re-enters rpcOnGo would otherwise
// clobber the shared scratch buffer mid-frame.
void testSendReentrancyGuard() {
  Harness h;
  auto msg = h.sendExpectingThrow(
      "{a: 1, get b() { return rpcOnGo({inner: true}); }, c: 3}");
  CHECK_MSG(msg.find("re-entered") != std::string::npos,
            "expected a re-entrancy error, got: " + msg);
  // Neither the inner nor the outer frame may reach the wire: a half-packed
  // outer frame would be a garbled write with no detection machinery.
  CHECK_EQ(h.writes.size(), size_t(0));

  // And the guard must have been cleared, so the next send is well-formed.
  h.send("{after: 1}");
  CHECK_EQ(h.writes.size(), size_t(1));
  auto oh = h.lastPayload();
  CHECK_MSG(oh.get().type == msgpack::type::MAP, "post-guard frame is malformed");
  CHECK_EQ(oh.get().via.map.size, uint32_t(1));

  kb::FrameParser parser;
  std::vector<msgpack::object_handle> out;
  Bytes copy = h.writes[0];
  parser.feed(copy.data(), copy.size(), out);
  CHECK_EQ(out.size(), size_t(1));
}

// A getter that mutates the container mid-walk must not desync the frame.
// For objects the property-name list is a snapshot, so a key deleted by an
// earlier getter still reads back as undefined and packs nil, keeping the map
// header's promised entry count honest.
void testSendMutatingObjectGetterPacksNil() {
  Harness h;
  h.send("(function () {"
         "  const o = {a: 1, b: 2, c: 3};"
         "  Object.defineProperty(o, 'b', {enumerable: true, configurable: "
         "true, get: function () { delete o.c; return 9; }});"
         "  return o;"
         "})()");
  auto oh = h.lastPayload();
  const auto &o = oh.get();
  CHECK_MSG(o.type == msgpack::type::MAP, "expected a MAP");
  CHECK_EQ(o.via.map.size, uint32_t(3));
  CHECK_EQ(o.via.map.ptr[1].val.as<int>(), 9);
  CHECK_MSG(o.via.map.ptr[2].val.type == msgpack::type::NIL,
            "key deleted by an earlier getter did not pack nil");
}

// Arrays behave differently from objects here: Hermes throws on an
// out-of-bounds getValueAtIndex rather than yielding undefined, so a getter
// that shrinks the array aborts the whole frame. That still upholds the
// invariant that matters -- nothing half-packed reaches the wire -- but it is
// a throw, not a run of nils.
void testSendShrinkingArrayGetterAbortsFrame() {
  Harness h;
  auto msg = h.sendExpectingThrow(
      "(function () {"
      "  const a = [1, 2, 3, 4];"
      "  Object.defineProperty(a, '1', {enumerable: true, configurable: true, "
      "get: function () { a.length = 2; return 9; }});"
      "  return a;"
      "})()");
  CHECK_MSG(!msg.empty(),
            "expected a shrinking array to abort the frame; it packed "
            "successfully instead");
  CHECK_MSG(h.writes.empty(),
            "an aborted frame reached writeToGo: " +
                std::to_string(h.writes.size()) + " write(s)");

  // The scratch buffer must still be usable afterwards.
  h.send("{after: 1}");
  CHECK_EQ(h.writes.size(), size_t(1));
  auto oh = h.lastPayload();
  CHECK_MSG(oh.get().type == msgpack::type::MAP, "post-abort frame is malformed");
}

} // namespace

int main() {
  kbtest::Runner runner;

  runner.add("packNumber: boundary table", testPackNumberTable);
  runner.add("packNumber: ulp neighborhoods",
             testPackNumberBoundaryNeighborhoods);
  runner.add("packNumber: 1M random doubles vs floor/isfinite reference",
             testPackNumberRandomSweep);

  runner.add("decode: BIN -> Uint8Array", testDecodeBinBecomesUint8Array);
  runner.add("decode: STR is not BIN", testDecodeStrIsNotBin);
  runner.add("decode: UTF-8, multibyte, embedded NUL", testDecodeUtf8Strings);
  runner.add("decode: empty array/map/string/binary", testDecodeEmptyContainers);
  runner.add("decode: EXT -> undefined", testDecodeExtBecomesUndefined);
  runner.add("decode: non-scalar map key throws",
             testDecodeNonScalarMapKeyThrows);
  runner.add("decode: scalar map keys stringify", testDecodeScalarMapKeysCoerce);
  runner.add("decode: kMaxDepth", testDecodeDepthLimit);

  runner.add("encode: Symbol/BigInt -> nil, map stays intact",
             testEncodeSymbolAndBigIntBecomeNil);
  runner.add("encode: function -> nil", testEncodeFunctionBecomesNil);
  runner.add("encode: ArrayBuffer.isView, not a digit-key heuristic",
             testEncodeIsViewNotDigitHeuristic);
  runner.add("encode: typed array byteOffset/byteLength bounds",
             testEncodeTypedArrayViews);
  runner.add("encode: empty containers", testEncodeEmptyContainers);
  runner.add("encode: UTF-8, multibyte, embedded NUL", testEncodeUtf8Strings);
  runner.add("encode: kMaxDepth", testEncodeDepthLimit);
  runner.add("round trip: decode then encode", testRoundTripThroughBothDirections);

  runner.add("batch: single frame delivers a bare value",
             testSingleFrameDeliversBareValue);
  runner.add("batch: multiple frames deliver an array",
             testMultiFrameDeliversArray);
  runner.add("batch: one survivor delivers a bare value",
             testBatchWithOneSurvivorDeliversBareValue);
  runner.add("batch: all undecodable escalates to onFatal",
             testBatchWithAllBadEscalatesToFatal);
  runner.add("batch: one undecodable message drops alone",
             testOneBadMessageDropsAlone);
  runner.add("batch: missing rpcOnJs is fatal", testMissingRpcOnJsIsFatal);
  runner.add("batch: framing violation is fatal", testFramingViolationIsFatal);

  runner.add("send: header matches packHeaderUint32 and FrameParser accepts it",
             testSendFrameHeaderAndRoundTripThroughParser);
  runner.add("send: returns the writeToGo result", testSendReturnsWriteResult);
  runner.add("send: oversize frame throws", testSendOversizeFrameThrows);
  runner.add("send: large payload then small", testSendLargePayloadThenSmall);
  runner.add("send: re-entrancy guard", testSendReentrancyGuard);
  runner.add("send: object getter that deletes a later key packs nil",
             testSendMutatingObjectGetterPacksNil);
  runner.add("send: array getter that shrinks the array aborts the frame",
             testSendShrinkingArrayGetterAbortsFrame);

  return runner.run();
}
