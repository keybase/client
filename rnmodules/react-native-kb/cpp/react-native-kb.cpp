#include "react-native-kb.h"
#include <cmath>
#include <cstring>
#include <limits>
#include "msgpack-safe.hpp"
#include <optional>
#include <string>
#include <utility>
#include <vector>

using namespace facebook;
using namespace facebook::jsi;

namespace kb {

namespace {
// A desynced length prefix can otherwise ask us to buffer gigabytes. Matches
// the JS-side packetizer limit.
constexpr uint64_t kMaxFrameSize = 64ull * 1024 * 1024;
// Conversion is iterative, so nesting costs heap rather than native stack.
// This is a sanity bound on pathological payloads, not a stack guard.
constexpr size_t kMaxDepth = 1024;
// Don't let one huge attachment frame permanently retain its peak size.
constexpr size_t kSendBufKeepCapacity = 4u * 1024 * 1024;
constexpr size_t kMaxCachedPropNames = 4096;
} // namespace

struct KBBridge::RecvState {
  msgpack::unpacker unpacker;
  ReadState state = ReadState::needSize;
};

struct KBBridge::SendState {
  msgpack::sbuffer sendBuf;
};

KBBridge::KBBridge() = default;
KBBridge::~KBBridge() = default;

void KBBridge::markTornDown() { isTornDown_.store(true); }

void KBBridge::teardown() {
  isTornDown_.store(true);
  releaseJSIState();
}

void KBBridge::tearup() { isTornDown_.store(false); }

// Clears cached JSI objects. Must run on the runtime's thread while the
// runtime is still alive — destroying jsi handles elsewhere is UB.
void KBBridge::releaseJSIState() {
  cachedUint8ArrayCtor_.reset();
  cachedIsView_.reset();
  cachedRpcOnJsName_.reset();
  cachedPropNames_.clear();
  cachedRuntime_ = nullptr;
}

void KBBridge::resetCaches(Runtime &runtime) {
  if (cachedRuntime_ != &runtime) {
    releaseJSIState();
    cachedRuntime_ = &runtime;
  }
}

void KBBridge::reportError(const std::string &msg) {
  if (onError_) {
    onError_(msg);
  }
}

void KBBridge::resetRecvLocked() { recv_ = std::make_unique<RecvState>(); }

Function &KBBridge::uint8ArrayCtor(Runtime &runtime) {
  resetCaches(runtime);
  if (!cachedUint8ArrayCtor_) {
    auto ctor = runtime.global().getPropertyAsFunction(runtime, "Uint8Array");
    cachedUint8ArrayCtor_ = std::make_unique<Function>(std::move(ctor));
  }
  return *cachedUint8ArrayCtor_;
}

Function &KBBridge::arrayBufferIsView(Runtime &runtime) {
  resetCaches(runtime);
  if (!cachedIsView_) {
    auto ab = runtime.global().getPropertyAsObject(runtime, "ArrayBuffer");
    auto fn = ab.getPropertyAsFunction(runtime, "isView");
    cachedIsView_ = std::make_unique<Function>(std::move(fn));
  }
  return *cachedIsView_;
}

bool KBBridge::isArrayBufferView(Runtime &runtime, const Object &obj) {
  auto res = arrayBufferIsView(runtime).call(runtime, Value(runtime, obj));
  return res.isBool() && res.getBool();
}

namespace {
// Single-pass copy into an uninitialized buffer. Constructing a
// Uint8Array of the target size would zero-fill it before we memcpy
// over it — two passes over large binary payloads instead of one.
class CopiedBuffer : public MutableBuffer {
public:
  CopiedBuffer(const char *ptr, size_t size)
      : buf_(new uint8_t[size]), size_(size) {
    if (size > 0) {
      std::memcpy(buf_.get(), ptr, size);
    }
  }
  size_t size() const override { return size_; }
  uint8_t *data() override { return buf_.get(); }

private:
  std::unique_ptr<uint8_t[]> buf_;
  size_t size_;
};

std::string mpToString(const msgpack::object &o) {
  switch (o.type) {
  case msgpack::type::STR:
    return o.as<std::string>();
  case msgpack::type::POSITIVE_INTEGER:
    return std::to_string(o.as<uint64_t>());
  case msgpack::type::NEGATIVE_INTEGER:
    return std::to_string(o.as<int64_t>());
  case msgpack::type::FLOAT32:
  case msgpack::type::FLOAT64:
    return std::to_string(o.as<double>());
  default:
    throw std::runtime_error("Invalid map key");
  }
}

void packNumber(msgpack::packer<msgpack::sbuffer> &pk, double d) {
  // Doubles can exactly represent integers up to 2^53. Encode exact
  // integers as msgpack int/uint (matching @msgpack/msgpack JS behavior)
  // so Go's decoder sees integer types, not float64. Integer-valued
  // doubles outside [INT64_MIN, UINT64_MAX] would be UB to cast, so
  // those stay float64. 18446744073709551616.0 == 2^64 and
  // -9223372036854775808.0 == -2^63 are both exact doubles.
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

void packBytes(msgpack::packer<msgpack::sbuffer> &pk, const uint8_t *data,
               size_t length) {
  if (length > std::numeric_limits<uint32_t>::max()) {
    throw std::runtime_error("binary payload too large");
  }
  pk.pack_bin(static_cast<uint32_t>(length));
  pk.pack_bin_body(reinterpret_cast<const char *>(data),
                   static_cast<uint32_t>(length));
}

// Frame for the iterative msgpack -> JSI walk. Exactly one of arr/obj is set.
struct BuildFrame {
  const msgpack::object *node = nullptr;
  uint32_t i = 0;
  bool isArray = false;
  std::optional<Array> arr;
  std::optional<Object> obj;
};

// Frame for the iterative JSI -> msgpack walk. `names` is the property-name
// snapshot for plain objects; `len` is captured up front because the msgpack
// map/array header is written before any of the children.
struct PackFrame {
  size_t i = 0;
  size_t len = 0;
  bool isArray = false;
  std::optional<Array> arr;
  std::optional<Object> obj;
  std::optional<Array> names;
};
} // namespace

Value KBBridge::binaryFromBytes(Runtime &runtime, const char *ptr,
                                size_t size) {
  ArrayBuffer buffer(runtime, std::make_shared<CopiedBuffer>(ptr, size));
  return uint8ArrayCtor(runtime).callAsConstructor(runtime,
                                                   std::move(buffer));
}

void KBBridge::setObjectKey(Runtime &runtime, Object &obj, const char *ptr,
                            size_t size, const Value &value) {
  // RPC maps reuse a small set of string keys; caching the PropNameIDs
  // avoids re-interning the same symbols on every message. The cache is
  // never cleared once full — maps keyed by dynamic IDs would otherwise
  // invalidate entries other frames still reference — so overflow keys
  // just build a throwaway PropNameID.
  propNameScratch_.assign(ptr, size);
  auto it = cachedPropNames_.find(propNameScratch_);
  if (it != cachedPropNames_.end()) {
    obj.setProperty(runtime, it->second, value);
    return;
  }
  auto name = PropNameID::forUtf8(
      runtime, reinterpret_cast<const uint8_t *>(ptr), size);
  if (cachedPropNames_.size() < kMaxCachedPropNames) {
    it = cachedPropNames_.emplace(propNameScratch_, std::move(name)).first;
    obj.setProperty(runtime, it->second, value);
    return;
  }
  obj.setProperty(runtime, name, value);
}

Value KBBridge::convertMPToJSI(Runtime &runtime, void *mpObj) {
  // Iterative rather than recursive: nesting depth is driven by the wire
  // payload, and a recursive walk would overflow the native stack.
  auto scalar = [&](const msgpack::object &o, Value &out) -> bool {
    switch (o.type) {
    case msgpack::type::STR:
      out = String::createFromUtf8(
          runtime, reinterpret_cast<const uint8_t *>(o.via.str.ptr),
          o.via.str.size);
      return true;
    case msgpack::type::POSITIVE_INTEGER:
    case msgpack::type::NEGATIVE_INTEGER:
    case msgpack::type::FLOAT32:
    case msgpack::type::FLOAT64:
      out = Value(o.as<double>());
      return true;
    case msgpack::type::BOOLEAN:
      out = Value(o.as<bool>());
      return true;
    case msgpack::type::NIL:
      out = Value::null();
      return true;
    case msgpack::type::BIN:
      out = binaryFromBytes(runtime, o.via.bin.ptr, o.via.bin.size);
      return true;
    case msgpack::type::MAP:
    case msgpack::type::ARRAY:
      return false;
    default:
      // EXT and anything unknown.
      out = Value::undefined();
      return true;
    }
  };

  auto makeFrame = [&](const msgpack::object &o) {
    BuildFrame f;
    f.node = &o;
    f.isArray = (o.type == msgpack::type::ARRAY);
    if (f.isArray) {
      f.arr.emplace(runtime, o.via.array.size);
    } else {
      f.obj.emplace(runtime);
    }
    return f;
  };

  // Attaches a finished child into its parent at the parent's cursor, then
  // advances the cursor.
  auto attach = [&](BuildFrame &f, const Value &value) {
    if (f.isArray) {
      f.arr->setValueAtIndex(runtime, f.i, value);
    } else {
      const auto &k = f.node->via.map.ptr[f.i].key;
      if (k.type == msgpack::type::STR) {
        setObjectKey(runtime, *f.obj, k.via.str.ptr, k.via.str.size, value);
      } else {
        auto keyStr = mpToString(k);
        setObjectKey(runtime, *f.obj, keyStr.data(), keyStr.size(), value);
      }
    }
    ++f.i;
  };

  const auto &root = *static_cast<msgpack::object *>(mpObj);
  Value out;
  if (scalar(root, out)) {
    return out;
  }

  std::vector<BuildFrame> stack;
  stack.reserve(16);
  stack.push_back(makeFrame(root));

  while (true) {
    BuildFrame &f = stack.back();
    const uint32_t size =
        f.isArray ? f.node->via.array.size : f.node->via.map.size;
    if (f.i >= size) {
      Value done =
          f.isArray ? Value(std::move(*f.arr)) : Value(std::move(*f.obj));
      stack.pop_back();
      if (stack.empty()) {
        return done;
      }
      attach(stack.back(), done);
      continue;
    }

    const msgpack::object &child =
        f.isArray ? f.node->via.array.ptr[f.i] : f.node->via.map.ptr[f.i].val;
    Value value;
    if (scalar(child, value)) {
      attach(f, value);
      continue;
    }
    if (stack.size() >= kMaxDepth) {
      throw std::runtime_error("msgpack nesting too deep");
    }
    // `f` is invalidated by the push; nothing below touches it.
    stack.push_back(makeFrame(child));
  }
}

void KBBridge::convertJSIToMP(Runtime &runtime, const Value &value,
                              void *packer) {
  auto &pk = *static_cast<msgpack::packer<msgpack::sbuffer> *>(packer);
  std::vector<PackFrame> stack;
  stack.reserve(16);

  auto packArrayBufferRange = [&](ArrayBuffer &arrayBuf, double offsetNum,
                                  double lengthNum) {
    auto bufferSize = arrayBuf.size(runtime);
    if (!std::isfinite(offsetNum) || !std::isfinite(lengthNum) ||
        offsetNum < 0 || lengthNum < 0 ||
        offsetNum != std::floor(offsetNum) ||
        lengthNum != std::floor(lengthNum) ||
        offsetNum > static_cast<double>(bufferSize) ||
        lengthNum > static_cast<double>(bufferSize)) {
      throw std::runtime_error("ArrayBuffer view is out of range");
    }
    auto offset = static_cast<size_t>(offsetNum);
    auto length = static_cast<size_t>(lengthNum);
    if (offset > bufferSize || length > bufferSize - offset) {
      throw std::runtime_error("ArrayBuffer view is out of range");
    }
    packBytes(pk, arrayBuf.data(runtime) + offset, length);
  };

  // TypedArray/DataView detection. The cheap byteLength probe lets plain RPC
  // objects bail after one property get; ArrayBuffer.isView then gives a
  // definitive answer, so an object that merely happens to carry
  // byteLength/buffer fields is never mistaken for binary. The range is
  // always bounds-checked against the backing buffer.
  auto tryPackTypedArray = [&](Object &obj) -> bool {
    auto byteLengthProp = obj.getProperty(runtime, "byteLength");
    if (!byteLengthProp.isNumber()) {
      return false;
    }
    if (!isArrayBufferView(runtime, obj)) {
      return false;
    }
    auto bufferProp = obj.getProperty(runtime, "buffer");
    if (!bufferProp.isObject()) {
      return false;
    }
    auto bufferObj = bufferProp.asObject(runtime);
    if (!bufferObj.isArrayBuffer(runtime)) {
      return false;
    }
    auto arrayBuf = bufferObj.getArrayBuffer(runtime);
    auto byteOffsetProp = obj.getProperty(runtime, "byteOffset");
    packArrayBufferRange(
        arrayBuf, byteOffsetProp.isNumber() ? byteOffsetProp.getNumber() : 0,
        byteLengthProp.getNumber());
    return true;
  };

  // Packs `v`. Containers write only their header here and push a frame; the
  // driver loop below walks their children.
  auto packOne = [&](const Value &v) {
    if (v.isNull() || v.isUndefined()) {
      pk.pack_nil();
      return;
    }
    if (v.isBool()) {
      pk.pack(v.getBool());
      return;
    }
    if (v.isNumber()) {
      packNumber(pk, v.getNumber());
      return;
    }
    if (v.isString()) {
      pk.pack(v.getString(runtime).utf8(runtime));
      return;
    }
    if (!v.isObject()) {
      // Symbol/BigInt. Packing nothing would desync the frame: the enclosing
      // map header already promised a value for this key.
      pk.pack_nil();
      return;
    }

    auto obj = v.getObject(runtime);
    if (obj.isArrayBuffer(runtime)) {
      auto buf = obj.getArrayBuffer(runtime);
      packBytes(pk, buf.data(runtime), buf.size(runtime));
      return;
    }
    if (obj.isFunction(runtime)) {
      pk.pack_nil();
      return;
    }
    if (stack.size() >= kMaxDepth) {
      throw std::runtime_error("object nesting too deep");
    }
    if (obj.isArray(runtime)) {
      auto arr = obj.getArray(runtime);
      auto len = arr.size(runtime);
      if (len > std::numeric_limits<uint32_t>::max()) {
        throw std::runtime_error("array too large");
      }
      pk.pack_array(static_cast<uint32_t>(len));
      if (len == 0) {
        return;
      }
      PackFrame f;
      f.isArray = true;
      f.len = len;
      f.arr.emplace(std::move(arr));
      stack.push_back(std::move(f));
      return;
    }
    if (tryPackTypedArray(obj)) {
      return;
    }

    auto names = obj.getPropertyNames(runtime);
    auto len = names.size(runtime);
    if (len > std::numeric_limits<uint32_t>::max()) {
      throw std::runtime_error("object too large");
    }
    pk.pack_map(static_cast<uint32_t>(len));
    if (len == 0) {
      return;
    }
    PackFrame f;
    f.isArray = false;
    f.len = len;
    f.obj.emplace(std::move(obj));
    f.names.emplace(std::move(names));
    stack.push_back(std::move(f));
  };

  packOne(value);

  while (!stack.empty()) {
    const size_t top = stack.size() - 1;
    if (stack[top].i >= stack[top].len) {
      stack.pop_back();
      continue;
    }
    const size_t idx = stack[top].i++;
    // Lengths are snapshots, so a getter that mutates the container can't
    // desync the frame: missing entries read back as undefined -> nil.
    Value child;
    if (stack[top].isArray) {
      child = stack[top].arr->getValueAtIndex(runtime, idx);
    } else {
      auto name = stack[top].names->getValueAtIndex(runtime, idx);
      if (!name.isString()) {
        // getPropertyNames doesn't enumerate symbol keys, but stay in sync
        // with the map header regardless.
        pk.pack(std::string());
        pk.pack_nil();
        continue;
      }
      auto nameStr = name.getString(runtime);
      pk.pack(nameStr.utf8(runtime));
      child = stack[top].obj->getProperty(runtime, nameStr);
    }
    // May push and invalidate references into `stack`; only indices are used
    // above, and nothing below touches the old frame.
    packOne(child);
  }
}

bool KBBridge::packAndSend(Runtime &runtime, const Value &value) {
  // convertJSIToMP runs JS getters, which could re-enter rpcOnGo and clobber
  // the shared scratch buffer mid-frame.
  if (packing_) {
    throw std::runtime_error("rpcOnGo re-entered from a property getter");
  }
  packing_ = true;
  struct Guard {
    bool &flag;
    ~Guard() { flag = false; }
  } guard{packing_};

  // Reserve space for the frame header (msgpack uint32 length prefix:
  // 0xce followed by 4 big-endian bytes) up front, then patch it in
  // place after packing — avoids copying the payload into a second
  // buffer just to prepend the header.
  constexpr size_t headerLen = 5;
  auto &sendBuf = send_->sendBuf;
  sendBuf.clear();
  const char placeholder[headerLen] = {0};
  sendBuf.write(placeholder, headerLen);
  msgpack::packer<msgpack::sbuffer> pk(&sendBuf);
  convertJSIToMP(runtime, value, &pk);

  auto contentBytes = sendBuf.size() - headerLen;
  if (contentBytes > kMaxFrameSize) {
    throw std::runtime_error("outgoing rpc frame too large");
  }
  auto contentSize = static_cast<uint32_t>(contentBytes);
  auto *header = reinterpret_cast<uint8_t *>(sendBuf.data());
  header[0] = 0xce;
  header[1] = static_cast<uint8_t>(contentSize >> 24);
  header[2] = static_cast<uint8_t>(contentSize >> 16);
  header[3] = static_cast<uint8_t>(contentSize >> 8);
  header[4] = static_cast<uint8_t>(contentSize);

  const bool ok = writeToGo_ ? writeToGo_(sendBuf.data(), sendBuf.size())
                             : false;

  if (sendBuf.size() > kSendBufKeepCapacity) {
    // Drop the whole buffer rather than keep one attachment's peak
    // allocation alive for the rest of the session. `sendBuf` dangles past
    // this point.
    send_ = std::make_unique<SendState>();
  }
  return ok;
}

void KBBridge::install(
    Runtime &runtime,
    std::shared_ptr<facebook::react::CallInvoker> callInvoker,
    std::function<bool(void *ptr, size_t size)> writeToGo,
    std::function<void(const std::string &)> onError,
    std::function<void()> onFatal) {
  callInvoker_ = std::move(callInvoker);
  onError_ = std::move(onError);
  onFatal_ = std::move(onFatal);
  writeToGo_ = std::move(writeToGo);
  send_ = std::make_unique<SendState>();
  {
    std::lock_guard<std::mutex> lock(recvMutex_);
    resetRecvLocked();
  }

  auto rpcOnGo = Function::createFromHostFunction(
      runtime, PropNameID::forAscii(runtime, "rpcOnGo"), 1,
      [self = shared_from_this()](Runtime &runtime, const Value &thisValue,
                                  const Value *arguments,
                                  size_t count) -> Value {
        if (count < 1) {
          throw std::runtime_error("rpcOnGo requires one argument");
        }
        if (self->isTornDown_.load() || !self->send_) {
          return Value(false);
        }
        try {
          return Value(self->packAndSend(runtime, arguments[0]));
        } catch (const std::exception &e) {
          throw std::runtime_error("Error in rpcOnGo: " +
                                   std::string(e.what()));
        } catch (...) {
          throw std::runtime_error("Unknown error in rpcOnGo");
        }
      });

  runtime.global().setProperty(runtime, "rpcOnGo", std::move(rpcOnGo));

  // HostObject that tears down when the JS runtime is destroyed. Its
  // destructor runs on the runtime's thread, which is the only place the
  // cached jsi handles may be released.
  class KBTearDownSimple : public jsi::HostObject {
  public:
    KBTearDownSimple(std::weak_ptr<KBBridge> bridge) : bridge_(bridge) {
      if (auto b = bridge_.lock()) {
        b->tearup();
      }
    }
    ~KBTearDownSimple() override {
      if (auto b = bridge_.lock()) {
        b->teardown();
      }
    }
    Value get(Runtime &, const PropNameID &) override {
      return Value::undefined();
    }
    void set(Runtime &, const PropNameID &, const Value &) override {}
    std::vector<PropNameID> getPropertyNames(Runtime &) override { return {}; }

  private:
    std::weak_ptr<KBBridge> bridge_;
  };

  runtime.global().setProperty(
      runtime, "kbTeardown",
      Object::createFromHostObject(
          runtime,
          std::make_shared<KBTearDownSimple>(shared_from_this())));
}

void KBBridge::onDataFromGo(uint8_t *data, int size) {
  if (isTornDown_.load() || size <= 0 || data == nullptr) {
    return;
  }

  auto values = std::make_shared<std::vector<msgpack::object_handle>>();
  bool fatal = false;
  std::string fatalMsg;

  {
    // Serialized against a stray second reader thread: msgpack::unpacker is
    // not thread safe, and a duplicate reader would corrupt the heap.
    std::lock_guard<std::mutex> lock(recvMutex_);
    if (!recv_) {
      return;
    }
    try {
      auto &up = recv_->unpacker;
      up.reserve_buffer(static_cast<size_t>(size));
      std::memcpy(up.buffer(), data, static_cast<size_t>(size));
      up.buffer_consumed(static_cast<size_t>(size));

      while (true) {
        msgpack::object_handle result;
        if (!up.next(result)) {
          break;
        }
        if (recv_->state == ReadState::needSize) {
          // The framing prefix must be a msgpack uint. Anything else means
          // the stream desynced; without this check the parity flips and
          // every later frame is silently swallowed as a "size".
          const auto &o = result.get();
          if (o.type != msgpack::type::POSITIVE_INTEGER ||
              o.as<uint64_t>() > kMaxFrameSize) {
            throw std::runtime_error("bad rpc frame header");
          }
          recv_->state = ReadState::needContent;
        } else {
          values->push_back(std::move(result));
          recv_->state = ReadState::needSize;
        }
      }

      if (up.nonparsed_size() > kMaxFrameSize) {
        throw std::runtime_error("rpc frame exceeds size limit");
      }
    } catch (const std::exception &e) {
      fatal = true;
      fatalMsg = std::string("Error in onDataFromGo: ") + e.what();
      resetRecvLocked();
    } catch (...) {
      fatal = true;
      fatalMsg = "Unknown error in onDataFromGo";
      resetRecvLocked();
    }
  }

  if (fatal) {
    reportError(fatalMsg);
    // The stream can no longer be trusted, so anything decoded in this batch
    // is dropped. The platform layer resets the Go connection and signals JS
    // so outstanding RPCs fail instead of hanging forever.
    if (onFatal_) {
      onFatal_();
    }
    return;
  }

  if (values->empty()) {
    return;
  }

  auto self = shared_from_this();
  callInvoker_->invokeAsync([values, self](jsi::Runtime &runtime) {
    try {
      if (self->isTornDown_.load()) {
        return;
      }

      self->resetCaches(runtime);
      if (!self->cachedRpcOnJsName_) {
        self->cachedRpcOnJsName_ = std::make_unique<PropNameID>(
            PropNameID::forAscii(runtime, "rpcOnJs"));
      }
      // Deliberately re-read the global each batch instead of caching the
      // function: JS installs a fresh rpcOnJs whenever the engine client is
      // recreated, and a cached handle would keep feeding the dead one.
      auto onJsValue =
          runtime.global().getProperty(runtime, *self->cachedRpcOnJsName_);
      if (!onJsValue.isObject() ||
          !onJsValue.getObject(runtime).isFunction(runtime)) {
        self->reportError("rpcOnJs is not installed");
        return;
      }
      auto onJs = onJsValue.getObject(runtime).getFunction(runtime);

      if (values->size() == 1) {
        // Single message: pass directly (no array wrapper)
        msgpack::object obj((*values)[0].get());
        Value value = self->convertMPToJSI(runtime, &obj);
        if (self->isTornDown_.load()) {
          return;
        }
        onJs.call(runtime, std::move(value), jsi::Value(1));
      } else {
        // Multiple messages: batch into array, pass count
        jsi::Array arr(runtime, values->size());
        for (size_t i = 0; i < values->size(); ++i) {
          msgpack::object obj((*values)[i].get());
          arr.setValueAtIndex(runtime, i,
                              self->convertMPToJSI(runtime, &obj));
        }
        if (self->isTornDown_.load()) {
          return;
        }
        onJs.call(runtime, std::move(arr),
                  jsi::Value(static_cast<int>(values->size())));
      }
    } catch (const std::exception &e) {
      self->reportError(e.what());
    } catch (...) {
      self->reportError("unknown error in onDataFromGo JS callback");
    }
  });
}

} // namespace kb
