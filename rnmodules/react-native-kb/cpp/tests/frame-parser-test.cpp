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

Bytes contentSplitBoundarySample() {
  return packContent([](auto &pk) {
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
}

// Feeds `frame` in two pieces at every possible split point (including the
// no-op splits at 0 and frame.size()) and checks that exactly one object of
// `wantType` is always decoded. Exercises totalFed - nonparsed_size()
// arithmetic, and in particular the header-partial-read bookkeeping
// (consumedAtHeader_ in frame-parser.h), at every possible split point across
// a single frame.
void sweepSplitBoundaries(const Bytes &frame, msgpack::type::object_type wantType) {
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
    CHECK(out[0].get().type == wantType);
  }
}

void testFrameSplitAtEveryByteBoundary() {
  // Minimal msgpack encoding: for this content's small size, the header
  // collapses to a 1-byte fixint rather than production's fixed 5-byte
  // header, so this sweep never lands a split inside a real header. Still
  // meaningful on its own merits: it covers a variable-length header (this
  // content also happens to fall in the fixint range) and the general
  // content-boundary arithmetic.
  Bytes frame = buildFrame(contentSplitBoundarySample());
  sweepSplitBoundaries(frame, msgpack::type::MAP);
}

void testFrameSplitAtEveryByteBoundaryProdHeader() {
  // Same sweep and same content as testFrameSplitAtEveryByteBoundary, but
  // with the header encoded exactly as production writes it (0xce tag + a
  // fixed 4-byte big-endian length, see packHeaderUint32() and
  // react-native-kb.cpp's packAndSend). This is what real traffic looks like
  // for small frames, and is the only encoding that actually exercises a
  // split landing inside bytes 1-4 of a real header.
  Bytes frame = buildFrameProdHeader(contentSplitBoundarySample());
  sweepSplitBoundaries(frame, msgpack::type::MAP);
}

void testMaxSizeFrameHeaderSplitBoundaries() {
  // A maximal (kMaxFrameSize) frame's header already requires msgpack's
  // uint32 format under minimal encoding, so this is production-accurate
  // without even needing packHeaderUint32 -- but the existing max-size
  // coverage (testOversizedFrameRejectedAndLegalMaxNotFalselyRejected) always
  // buffers the whole 5-byte header in a single chunk (its fixed
  // 65537-byte chunking never happens to split within the first 5 bytes).
  // This sweeps every split point within and just past the header so the
  // "header split across two feeds" case is covered for the largest frame
  // the parser accepts, not just for small frames. (A full byte-by-byte
  // sweep across the entire 64MB body would be O(n^2) and impractically
  // slow, so this only sweeps the header region.)
  Bytes content = contentBinOfWireSize(FrameParser::kMaxFrameSize);
  CHECK_EQ(content.size(), FrameParser::kMaxFrameSize);
  Bytes frame = buildFrameProdHeader(content);
  constexpr size_t kHeaderLen = 5;
  for (size_t split = 0; split <= kHeaderLen + 2; ++split) {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    if (split > 0) {
      parser.feed(frame.data(), split, out);
    }
    parser.feed(frame.data() + split, frame.size() - split, out);
    CHECK_MSG(out.size() == 1,
             "split at " + std::to_string(split) + " produced " +
                 std::to_string(out.size()) + " messages, want 1");
    CHECK(out[0].get().type == msgpack::type::BIN);
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
  // small chunks must NOT be falsely rejected. next() consumes the msgpack
  // object as soon as it's fully buffered, so by the time the
  // nonparsed_size() > kMaxFrameSize + kMaxFrameSlack check runs at the end
  // of feed(), nonparsed_size() is already back to 0 for this scenario --
  // this pins down that the header check's `> kMaxFrameSize` (not `>=`)
  // comparison accepts a declared size of exactly kMaxFrameSize, not the
  // kMaxFrameSlack margin.
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

// reset() is called from its own frame, which is then deliberately overwritten
// before the parser is used again. If reset() left the unpacker holding a
// reference into that frame (which move-assignment does), the reference now
// points at the fill pattern rather than at plausible-looking leftovers, so the
// test fails on every run instead of only when the stack happens to be reused.
[[gnu::noinline]] void resetInOwnFrame(FrameParser &parser) { parser.reset(); }

[[gnu::noinline]] void clobberStack() {
  volatile char scratch[8192];
  for (size_t i = 0; i < sizeof(scratch); ++i) {
    scratch[i] = static_cast<char>(0xab);
  }
}

void testResetThenBufferGrowth() {
  // reset() must leave a parser that is safe to grow, not just safe to reuse.
  // msgpack::unpacker cannot be move-assigned: its parser base keeps a
  // reference to the finalizer object inside the unpacker, and the move
  // constructor copies that reference instead of rebinding it, so a
  // move-assigned unpacker points at the destroyed source. Nothing goes wrong
  // until the buffer has to expand -- which is why every existing reset test
  // passed while the real reader crashed on the first sizeable frame after a
  // reset.
  FrameParser parser;
  std::vector<msgpack::object_handle> out;

  Bytes first = buildFrame(packContent([](auto &pk) { pk.pack(1); }));
  parser.feed(first.data(), first.size(), out);
  CHECK_EQ(out.size(), 1u);

  for (int round = 0; round < 3; ++round) {
    resetInOwnFrame(parser);
    clobberStack();
    out.clear();

    // The finalizer is only consulted when the buffer has to grow while it is
    // still referenced, i.e. when a frame that has already had a string parsed
    // out of it is still incomplete and the buffer must be reallocated to hold
    // the rest. A multi-field frame arriving across several reads -- an
    // everyday RPC reply -- does exactly that.
    const size_t big = 2u * 1024 * 1024;
    Bytes frame = buildFrame(packContent([big](auto &pk) {
      pk.pack_array(2);
      pk.pack(std::string(1024, 'r'));
      pk.pack(std::string(big, 'z'));
    }));
    feedInChunks(parser, frame, 64 * 1024, out);
    CHECK_EQ(out.size(), 1u);
    CHECK_EQ(out[0].get().via.array.ptr[1].via.str.size, big);
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
  runner.add("frame_split_at_every_byte_boundary_prod_header",
            testFrameSplitAtEveryByteBoundaryProdHeader);
  runner.add("max_size_frame_header_split_boundaries",
            testMaxSizeFrameHeaderSplitBoundaries);
  runner.add("consumed_equals_declared_across_sizes",
            testConsumedEqualsDeclaredAcrossSizes);
  runner.add("declared_length_mismatch_detected",
            testDeclaredLengthMismatchDetected);
  runner.add("non_integer_header_detected", testNonIntegerHeaderDetected);
  runner.add("declared_size_zero_rejected", testDeclaredSizeZeroRejected);
  runner.add("oversized_frame_rejected_and_legal_max_not_falsely_rejected",
            testOversizedFrameRejectedAndLegalMaxNotFalselyRejected);
  runner.add("recovery_after_error_and_reset", testRecoveryAfterErrorAndReset);
  runner.add("reset_then_buffer_growth", testResetThenBufferGrowth);
  runner.add("buffer_shrink_fires_and_arithmetic_holds_after_shrink",
            testBufferShrinkFiresAndArithmeticHoldsAfterShrink);
  runner.add("nested_and_empty_containers_roundtrip",
            testNestedAndEmptyContainersRoundtrip);
  return runner.run();
}
