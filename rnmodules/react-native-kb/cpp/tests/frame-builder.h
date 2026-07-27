// Test-only helpers for constructing raw `<uint length><msgpack object>`
// frames byte-for-byte, mirroring the JS-side packetizer that FrameParser
// decodes.
#pragma once

#include "../msgpack-safe.hpp"
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace kbtest {

using Bytes = std::vector<uint8_t>;

inline Bytes sbufferToBytes(const msgpack::sbuffer &buf) {
  const auto *p = reinterpret_cast<const uint8_t *>(buf.data());
  return Bytes(p, p + buf.size());
}

// Packs `fn(packer)` into a standalone msgpack object and returns its wire
// bytes.
inline Bytes packContent(
    const std::function<void(msgpack::packer<msgpack::sbuffer> &)> &fn) {
  msgpack::sbuffer buf;
  msgpack::packer<msgpack::sbuffer> pk(&buf);
  fn(pk);
  return sbufferToBytes(buf);
}

// Packs a bare msgpack unsigned integer header (the smallest encoding msgpack
// chooses for `value`). Useful for exercising the parser against header
// encodings other than the one production actually emits (e.g. small values
// that fit in a 1-byte fixint).
inline Bytes packHeader(uint64_t value) {
  msgpack::sbuffer buf;
  msgpack::packer<msgpack::sbuffer> pk(&buf);
  pk.pack_uint64(value);
  return sbufferToBytes(buf);
}

// Packs the frame header exactly as production writes it
// (react-native-kb.cpp's packAndSend): always 5 bytes -- a 0xce ("uint 32")
// tag byte followed by a big-endian uint32 length -- regardless of how small
// `value` is. Unlike packHeader() above, this never picks a smaller encoding,
// so it's the encoding that must be used to faithfully exercise the header
// split-boundary arithmetic.
inline Bytes packHeaderUint32(uint32_t value) {
  Bytes out(5);
  out[0] = 0xce;
  out[1] = static_cast<uint8_t>(value >> 24);
  out[2] = static_cast<uint8_t>(value >> 16);
  out[3] = static_cast<uint8_t>(value >> 8);
  out[4] = static_cast<uint8_t>(value);
  return out;
}

// A well-formed frame: header declares content.size(), content follows.
inline Bytes buildFrame(const Bytes &content) {
  Bytes out = packHeader(content.size());
  out.insert(out.end(), content.begin(), content.end());
  return out;
}

// Same as buildFrame(), but with the header encoded exactly as production
// writes it (see packHeaderUint32()) rather than msgpack's minimal encoding.
inline Bytes buildFrameProdHeader(const Bytes &content) {
  Bytes out = packHeaderUint32(static_cast<uint32_t>(content.size()));
  out.insert(out.end(), content.begin(), content.end());
  return out;
}

// A frame whose declared size does not match content.size() -- for testing
// the length-mismatch detection.
inline Bytes buildFrameWithDeclaredSize(uint64_t declaredSize,
                                       const Bytes &content) {
  Bytes out = packHeader(declaredSize);
  out.insert(out.end(), content.begin(), content.end());
  return out;
}

// Convenience content generators.

inline Bytes contentSmallMap() {
  return packContent([](auto &pk) {
    pk.pack_map(2);
    pk.pack(std::string("type"));
    pk.pack(1);
    pk.pack(std::string("seqid"));
    pk.pack(42);
  });
}

inline Bytes contentEmptyMap() {
  return packContent([](auto &pk) { pk.pack_map(0); });
}

inline Bytes contentEmptyArray() {
  return packContent([](auto &pk) { pk.pack_array(0); });
}

// Binary payload of exactly `totalWireSize` bytes on the wire (header +
// body), using bin32 encoding (5-byte header) which applies once the body
// exceeds 65535 bytes. Lets a caller hit an exact target frame size, such as
// exactly kMaxFrameSize.
inline Bytes contentBinOfWireSize(size_t totalWireSize) {
  constexpr size_t kBin32HeaderLen = 5;
  size_t bodyLen = totalWireSize - kBin32HeaderLen;
  msgpack::sbuffer buf;
  msgpack::packer<msgpack::sbuffer> pk(&buf);
  pk.pack_bin(static_cast<uint32_t>(bodyLen));
  std::string body(bodyLen, 'x');
  pk.pack_bin_body(body.data(), static_cast<uint32_t>(bodyLen));
  return sbufferToBytes(buf);
}

inline void packNestedArray(msgpack::packer<msgpack::sbuffer> &pk,
                            int depth) {
  if (depth == 0) {
    pk.pack(42);
    return;
  }
  pk.pack_array(1);
  packNestedArray(pk, depth - 1);
}

inline Bytes contentNested(int depth) {
  return packContent(
      [depth](auto &pk) { packNestedArray(pk, depth); });
}

// Non-integer header content (a string), for the "bad header type" case.
inline Bytes headerAsString() {
  return packContent([](auto &pk) { pk.pack(std::string("not a size")); });
}

} // namespace kbtest
