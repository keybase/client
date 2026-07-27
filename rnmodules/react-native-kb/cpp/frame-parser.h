// Pure msgpack framing state machine, deliberately free of jsi/React/platform
// dependencies so it can be unit tested without a JS runtime. See
// react-native-kb.cpp's onDataFromGo for how the JSI-facing half (delivery to
// JS, epoch handling, error reporting) wraps this.
#pragma once

#include "msgpack-safe.hpp"
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace kb {

// Decodes a stream of `<uint32 length><msgpack object>` frames, matching the
// JS-side packetizer. Not thread safe; the caller (KBBridge::onDataFromGo)
// serializes access under recvMutex_.
class FrameParser {
public:
  // A desynced length prefix can otherwise ask us to buffer gigabytes.
  // Matches the JS-side packetizer limit.
  static constexpr uint64_t kMaxFrameSize = 64ull * 1024 * 1024;
  // nonparsed_size() includes the frame header plus any bytes of the next
  // frame already buffered in the same read; the header check separately
  // accepts a declared size of exactly kMaxFrameSize. Without this margin a
  // legal maximal frame arriving in small chunks trips the limit on its last
  // chunk.
  static constexpr size_t kMaxFrameSlack = 1024 * 1024;
  // msgpack::unpacker rewinds its buffer in place but never shrinks the
  // realloc'd allocation, so this bounds how long a single large frame's peak
  // stays resident.
  static constexpr size_t kRecvBufKeepCapacity = 4u * 1024 * 1024;

  FrameParser() = default;
  FrameParser(const FrameParser &) = delete;
  FrameParser &operator=(const FrameParser &) = delete;

  // Feeds `size` bytes of newly received data into the unpacker and decodes
  // as many complete frames as are now available, appending them to `out` in
  // wire order. Throws std::runtime_error (with a descriptive message) on any
  // framing violation: bad header type/value, length mismatch, or exceeding
  // the size limit. On throw, `out` may already contain frames decoded
  // earlier in this same call -- the caller must reset() before continuing,
  // since the stream can no longer be trusted from that point on.
  void feed(const uint8_t *data, size_t size,
            std::vector<msgpack::object_handle> &out);

  // Drops any partially parsed frame and all buffered state, starting over
  // from a fresh unpacker. Must be called after feed() throws, or whenever
  // the underlying byte stream is known to have been replaced (e.g. the Go
  // connection was redialed), since resuming mid-frame on a new stream would
  // fail the next header check on otherwise-valid data.
  void reset();

  // True if state == needSize, nonparsed_size() == 0 (no partial frame and no
  // unparsed bytes buffered), and peakFrameSize since the last reset exceeds
  // kRecvBufKeepCapacity. This is a provably safe resync point at which the
  // caller may choose to reset() purely to release a large realloc'd buffer,
  // independent of any framing error.
  bool atSafeShrinkPoint() const;

private:
  enum class ReadState { needSize, needContent };

  msgpack::unpacker unpacker_;
  ReadState state_ = ReadState::needSize;
  // Persist across calls: a frame's header and its content routinely arrive
  // in separate reads.
  size_t declaredSize_ = 0;
  size_t consumedAtHeader_ = 0;
  // Every byte ever handed to the unpacker. parsed_size() cannot serve this
  // role -- next() zeroes it on each success -- but totalFed minus
  // nonparsed_size() is an accurate running count of what has been consumed.
  size_t totalFed_ = 0;
  // High-water mark of declaredSize since the last reset. declaredSize
  // itself gets overwritten by the next header before we necessarily reach a
  // safe (nonparsed_size() == 0) point to act on it, so this survives that
  // overwrite and lets the shrink check fire for the frame that actually
  // grew the buffer.
  size_t peakFrameSize_ = 0;
};

} // namespace kb
