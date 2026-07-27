// Unit tests for FrameParser, the pure msgpack framing state machine
// extracted from KBBridge::onDataFromGo (see ../frame-parser.h). No jsi/React
// dependency: these exercise the exact production framing arithmetic without
// a JS runtime.
#include "../frame-parser.h"
#include "frame-builder.h"
#include "test-harness.h"
#include <stdexcept>
#include <string>

using kb::FrameParser;
using namespace kbtest;

namespace {

// Feeds `frame` to `parser` in chunks of `chunkSize` bytes (last chunk may be
// smaller), appending decoded objects to `out`.
void feedInChunks(FrameParser &parser, const Bytes &frame, size_t chunkSize,
                  std::vector<msgpack::object_handle> &out) {
  size_t pos = 0;
  while (pos < frame.size()) {
    size_t n = std::min(chunkSize, frame.size() - pos);
    parser.feed(frame.data() + pos, n, out);
    pos += n;
  }
}

void testSingleFrameDecodesOne() {
  FrameParser parser;
  std::vector<msgpack::object_handle> out;
  Bytes frame = buildFrame(contentSmallMap());
  parser.feed(frame.data(), frame.size(), out);
  CHECK_EQ(out.size(), 1u);
  CHECK(out[0].get().type == msgpack::type::MAP);
}

void testMultipleFramesCoalescedInOrder() {
  FrameParser parser;
  std::vector<msgpack::object_handle> out;
  Bytes all;
  for (int i = 0; i < 5; ++i) {
    Bytes content = packContent(
        [i](auto &pk) { pk.pack_array(1); pk.pack(i); });
    Bytes frame = buildFrame(content);
    all.insert(all.end(), frame.begin(), frame.end());
  }
  parser.feed(all.data(), all.size(), out);
  CHECK_EQ(out.size(), 5u);
  for (int i = 0; i < 5; ++i) {
    const auto &o = out[static_cast<size_t>(i)].get();
    CHECK(o.type == msgpack::type::ARRAY);
    CHECK_EQ(o.via.array.ptr[0].as<int>(), i);
  }
}

void testFrameSplitAcrossTwoFeeds() {
  FrameParser parser;
  std::vector<msgpack::object_handle> out;
  Bytes frame = buildFrame(contentSmallMap());
  // Header in one feed, content in the next.
  Bytes header = packHeader(contentSmallMap().size());
  parser.feed(frame.data(), header.size(), out);
  CHECK_EQ(out.size(), 0u);
  parser.feed(frame.data() + header.size(), frame.size() - header.size(),
             out);
  CHECK_EQ(out.size(), 1u);
}

void testFrameSplitAtEveryByteBoundary() {
  // Exercises totalFed - nonparsed_size() arithmetic at every possible split
  // point across a single frame.
  Bytes content = packContent([](auto &pk) {
    pk.pack_map(3);
    pk.pack(std::string("a"));
    pk.pack(1);
    pk.pack(std::string("b"));
    pk.pack(std::string("some string value"));
    pk.pack(std::string("c"));
    pk.pack_array(3);
    pk.pack(1);
    pk.pack(2);
    pk.pack(3);
  });
  Bytes frame = buildFrame(content);

  for (size_t split = 0; split <= frame.size(); ++split) {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    if (split > 0) {
      parser.feed(frame.data(), split, out);
    }
    if (split < frame.size()) {
      parser.feed(frame.data() + split, frame.size() - split, out);
    }
    CHECK_MSG(out.size() == 1,
             "split at " + std::to_string(split) + " produced " +
                 std::to_string(out.size()) + " messages, want 1");
    CHECK(out[0].get().type == msgpack::type::MAP);
  }
}

void testConsumedEqualsDeclaredAcrossSizes() {
  // Includes a payload well past msgpack::unpacker's default initial buffer,
  // forcing at least one internal reserve/grow.
  const std::vector<size_t> sizes = {0, 1, 100, 4096, 1u << 20};
  for (size_t n : sizes) {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    Bytes content = packContent([n](auto &pk) {
      std::string body(n, 'z');
      pk.pack(body);
    });
    Bytes frame = buildFrame(content);
    parser.feed(frame.data(), frame.size(), out);
    CHECK_MSG(out.size() == 1, "size " + std::to_string(n));
    CHECK(out[0].get().type == msgpack::type::STR);
    CHECK_EQ(out[0].get().via.str.size, static_cast<uint32_t>(n));
  }
}

void testDeclaredLengthMismatchDetected() {
  FrameParser parser;
  std::vector<msgpack::object_handle> out;
  Bytes content = contentSmallMap();
  Bytes frame = buildFrameWithDeclaredSize(content.size() + 3, content);
  bool threw = false;
  try {
    parser.feed(frame.data(), frame.size(), out);
  } catch (const std::runtime_error &e) {
    threw = true;
    CHECK_MSG(std::string(e.what()).find("length mismatch") !=
                 std::string::npos,
             std::string("unexpected message: ") + e.what());
  }
  CHECK_MSG(threw, "expected a length-mismatch throw");
}

void testNonIntegerHeaderDetected() {
  FrameParser parser;
  std::vector<msgpack::object_handle> out;
  Bytes badHeader = headerAsString();
  bool threw = false;
  try {
    parser.feed(badHeader.data(), badHeader.size(), out);
  } catch (const std::runtime_error &e) {
    threw = true;
    CHECK_MSG(std::string(e.what()).find("bad rpc frame header") !=
                 std::string::npos,
             std::string("unexpected message: ") + e.what());
  }
  CHECK_MSG(threw, "expected a bad-header throw");
}

void testDeclaredSizeZeroRejected() {
  FrameParser parser;
  std::vector<msgpack::object_handle> out;
  // No msgpack object is zero bytes, so a declared size of 0 can never be
  // satisfied by real content -- it must surface as a length mismatch.
  Bytes content = contentEmptyMap();
  Bytes frame = buildFrameWithDeclaredSize(0, content);
  bool threw = false;
  try {
    parser.feed(frame.data(), frame.size(), out);
  } catch (const std::runtime_error &) {
    threw = true;
  }
  CHECK_MSG(threw, "expected declared size 0 to be rejected");
}

void testOversizedFrameRejectedAndLegalMaxNotFalselyRejected() {
  // A header declaring more than kMaxFrameSize is rejected immediately.
  {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    Bytes header = packHeader(FrameParser::kMaxFrameSize + 1);
    bool threw = false;
    try {
      parser.feed(header.data(), header.size(), out);
    } catch (const std::runtime_error &) {
      threw = true;
    }
    CHECK_MSG(threw, "expected a >max-size header to be rejected");
  }

  // A LEGAL maximal frame (declaredSize == kMaxFrameSize exactly) arriving in
  // small chunks must NOT be falsely rejected by the nonparsed_size() vs.
  // size-limit check. This proves the kMaxFrameSlack margin fix.
  {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    Bytes content = contentBinOfWireSize(FrameParser::kMaxFrameSize);
    CHECK_EQ(content.size(), FrameParser::kMaxFrameSize);
    Bytes frame = buildFrame(content);
    constexpr size_t kChunkSize = 65537; // deliberately not a divisor
    feedInChunks(parser, frame, kChunkSize, out);
    CHECK_EQ(out.size(), 1u);
    CHECK(out[0].get().type == msgpack::type::BIN);
  }
}

void testRecoveryAfterErrorAndReset() {
  FrameParser parser;
  std::vector<msgpack::object_handle> out;
  Bytes bad = headerAsString();
  bool threw = false;
  try {
    parser.feed(bad.data(), bad.size(), out);
  } catch (const std::runtime_error &) {
    threw = true;
  }
  CHECK_MSG(threw, "setup: expected the bad header to throw");
  parser.reset();

  for (int i = 0; i < 3; ++i) {
    Bytes content = packContent([i](auto &pk) { pk.pack(i); });
    Bytes frame = buildFrame(content);
    parser.feed(frame.data(), frame.size(), out);
  }
  CHECK_EQ(out.size(), 3u);
  for (int i = 0; i < 3; ++i) {
    CHECK_EQ(out[static_cast<size_t>(i)].get().as<int>(), i);
  }
}

void testBufferShrinkFiresAndArithmeticHoldsAfterShrink() {
  FrameParser parser;
  std::vector<msgpack::object_handle> out;

  // A frame comfortably larger than kRecvBufKeepCapacity.
  const size_t bigSize = FrameParser::kRecvBufKeepCapacity + (1u << 20);
  Bytes bigContent = packContent(
      [bigSize](auto &pk) { pk.pack(std::string(bigSize, 'q')); });
  Bytes bigFrame = buildFrame(bigContent);
  parser.feed(bigFrame.data(), bigFrame.size(), out);
  CHECK_EQ(out.size(), 1u);

  // A small frame right after it. peakFrameSize must remember the earlier
  // large frame, not get overwritten by this small one's declaredSize -- this
  // is the regression the peakFrameSize fix addressed.
  Bytes smallContent = packContent([](auto &pk) { pk.pack(7); });
  Bytes smallFrame = buildFrame(smallContent);
  parser.feed(smallFrame.data(), smallFrame.size(), out);
  CHECK_EQ(out.size(), 2u);

  CHECK_MSG(parser.atSafeShrinkPoint(),
           "expected a safe shrink point after a big frame followed by a "
           "small one");

  // Mirror what onDataFromGo does at a safe shrink point: drop and rebuild.
  parser.reset();

  // Framing arithmetic must still hold for frames decoded after the shrink.
  for (int i = 0; i < 4; ++i) {
    Bytes content = packContent([i](auto &pk) { pk.pack(100 + i); });
    Bytes frame = buildFrame(content);
    parser.feed(frame.data(), frame.size(), out);
  }
  CHECK_EQ(out.size(), 6u);
  for (int i = 0; i < 4; ++i) {
    CHECK_EQ(out[2 + static_cast<size_t>(i)].get().as<int>(), 100 + i);
  }
}

void testNestedAndEmptyContainersRoundtrip() {
  {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    Bytes frame = buildFrame(contentEmptyMap());
    parser.feed(frame.data(), frame.size(), out);
    CHECK_EQ(out.size(), 1u);
    CHECK(out[0].get().type == msgpack::type::MAP);
    CHECK_EQ(out[0].get().via.map.size, 0u);
  }
  {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    Bytes frame = buildFrame(contentEmptyArray());
    parser.feed(frame.data(), frame.size(), out);
    CHECK_EQ(out.size(), 1u);
    CHECK(out[0].get().type == msgpack::type::ARRAY);
    CHECK_EQ(out[0].get().via.array.size, 0u);
  }
  {
    // Near but under a typical application-level depth limit (1024 in
    // react-native-kb.cpp); FrameParser itself has no depth limit of its
    // own, so this proves the raw decode handles realistic nesting.
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    const int depth = 900;
    Bytes frame = buildFrame(contentNested(depth));
    parser.feed(frame.data(), frame.size(), out);
    CHECK_EQ(out.size(), 1u);
    const msgpack::object *cur = &out[0].get();
    int seen = 0;
    while (cur->type == msgpack::type::ARRAY) {
      CHECK_EQ(cur->via.array.size, 1u);
      cur = &cur->via.array.ptr[0];
      ++seen;
    }
    CHECK_EQ(seen, depth);
    CHECK_EQ(cur->as<int>(), 42);
  }
}

} // namespace

int main() {
  Runner runner;
  runner.add("single_frame_decodes_one_message", testSingleFrameDecodesOne);
  runner.add("multiple_frames_coalesced_decode_in_order",
            testMultipleFramesCoalescedInOrder);
  runner.add("frame_split_across_two_feeds", testFrameSplitAcrossTwoFeeds);
  runner.add("frame_split_at_every_byte_boundary",
            testFrameSplitAtEveryByteBoundary);
  runner.add("consumed_equals_declared_across_sizes",
            testConsumedEqualsDeclaredAcrossSizes);
  runner.add("declared_length_mismatch_detected",
            testDeclaredLengthMismatchDetected);
  runner.add("non_integer_header_detected", testNonIntegerHeaderDetected);
  runner.add("declared_size_zero_rejected", testDeclaredSizeZeroRejected);
  runner.add("oversized_frame_rejected_and_legal_max_not_falsely_rejected",
            testOversizedFrameRejectedAndLegalMaxNotFalselyRejected);
  runner.add("recovery_after_error_and_reset", testRecoveryAfterErrorAndReset);
  runner.add("buffer_shrink_fires_and_arithmetic_holds_after_shrink",
            testBufferShrinkFiresAndArithmeticHoldsAfterShrink);
  runner.add("nested_and_empty_containers_roundtrip",
            testNestedAndEmptyContainersRoundtrip);
  return runner.run();
}
