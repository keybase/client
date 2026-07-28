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

// `padBytes` inflates the "b" value so callers can steer which msgpack
// encoding packHeader() picks for the frame header (fixint / uint16 / uint32)
// while keeping the object shape identical.
Bytes contentSplitBoundarySample(size_t padBytes = 0) {
  return packContent([padBytes](auto &pk) {
    pk.pack_map(3);
    pk.pack(std::string("a"));
    pk.pack(1);
    pk.pack(std::string("b"));
    pk.pack(std::string("some string value") + std::string(padBytes, 'p'));
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

void testFrameSplitAtEveryByteBoundaryUint16Header() {
  // The third header encoding the parser can meet: padded past 255 bytes so
  // packHeader() picks msgpack's uint16 form (0xcd + 2 bytes) rather than the
  // 1-byte fixint a small payload collapses to, or the uint32 form
  // ..._prod_header sweeps. A 3-byte header is the only length for which
  // consumedAtHeader_ can be latched after a split that lands at header byte
  // 1 or 2, so this sweep is load-bearing rather than a subset of the
  // production-header sweep.
  Bytes content = contentSplitBoundarySample(300);
  CHECK(content.size() > 255 && content.size() < 65536);
  Bytes frame = buildFrame(content);
  CHECK_EQ(frame.size(), content.size() + 3u);
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
  } catch (const std::runtime_error &e) {
    threw = true;
    // Must be the content-vs-declared check, not the slack guard and not a
    // throw escaping msgpack's own parser.
    CHECK_MSG(std::string(e.what()).find("length mismatch") !=
                 std::string::npos,
             std::string("unexpected message: ") + e.what());
  }
  CHECK_MSG(threw, "expected declared size 0 to be rejected");
  CHECK_EQ(out.size(), 0u);
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
    } catch (const std::runtime_error &e) {
      threw = true;
      // Specifically the header's `> kMaxFrameSize` check. The slack guard
      // ("exceeds size limit") cannot be what fires here: only 9 bytes have
      // been fed, so this pins the rejection to the header, not to buffering.
      CHECK_MSG(std::string(e.what()).find("bad rpc frame header") !=
                   std::string::npos,
               std::string("unexpected message: ") + e.what());
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

void testUnboundedBufferingRejectedBySlackGuard() {
  // Pins the end-of-feed() guard in frame-parser.cpp:
  //   if (unpacker_->nonparsed_size() > kMaxFrameSize + kMaxFrameSlack) throw
  //
  // Every other size test is rejected at the *header* check instead, because
  // they feed a complete msgpack object whose declared size next() can read.
  // The case that guard actually exists for is a corrupt length prefix that
  // never completes an object at all: next() keeps returning false, the header
  // check is never reached, and the unpacker buffers every byte forever. Here
  // a bin32 tag claims a 4GB body, so no amount of data completes it and
  // nonparsed_size() grows monotonically. Without the guard the only outcome
  // is an OOM kill.
  FrameParser parser;
  std::vector<msgpack::object_handle> out;

  Bytes tag = bin32TagOnly(0xffffffffu);
  parser.feed(tag.data(), tag.size(), out);
  CHECK_EQ(out.size(), 0u);

  const size_t kLimit = FrameParser::kMaxFrameSize + FrameParser::kMaxFrameSlack;
  const size_t kChunk = 4u * 1024 * 1024;
  // Enough body bytes to push nonparsed_size() past the limit, plus a chunk of
  // margin so the crossing definitely happens inside the loop.
  const size_t kTotal = kLimit + kChunk;
  Bytes chunk(kChunk, 'x');

  bool threw = false;
  size_t fed = tag.size();
  while (fed < kTotal && !threw) {
    try {
      parser.feed(chunk.data(), chunk.size(), out);
      fed += chunk.size();
      // While still under the limit the parser must stay quiet, not deliver
      // anything, and not reject a merely-large-but-legal buffer.
      CHECK_MSG(fed <= kLimit,
               "buffered " + std::to_string(fed) +
                   " bytes past the limit without throwing");
    } catch (const std::runtime_error &e) {
      threw = true;
      CHECK_MSG(std::string(e.what()).find("exceeds size limit") !=
                   std::string::npos,
               std::string("unexpected message: ") + e.what());
      // The crossing must not happen early: a legal 64MB frame's bytes are
      // still in flight below the limit.
      CHECK_MSG(fed + kChunk > kLimit,
               "rejected at " + std::to_string(fed) +
                   " bytes, before the limit");
    }
  }
  CHECK_MSG(threw, "expected unbounded buffering to be rejected");
  CHECK_EQ(out.size(), 0u);
}

void testSafeShrinkPointFalseWhenUnsafe() {
  // atSafeShrinkPoint() has three conjuncts and the existing coverage only
  // asserts the all-true case, so `return true;` passes the whole suite. Each
  // block below leaves exactly one conjunct false. Acting on a false positive
  // means the caller reset()s -- zeroing totalFed_/consumedAtHeader_ -- while
  // a partial frame is still buffered, which guarantees a length mismatch on
  // the very next frame and a fatal/reset cycle on healthy traffic.

  const size_t bigSize = FrameParser::kRecvBufKeepCapacity + (1u << 20);
  Bytes bigContent =
      packContent([bigSize](auto &pk) { pk.pack(std::string(bigSize, 'q')); });
  Bytes bigFrame = buildFrame(bigContent);
  Bytes bigHeader = packHeader(bigContent.size());

  // (1) peakFrameSize_ <= kRecvBufKeepCapacity: nothing large has been seen,
  // so there is no oversized allocation to release. state_/nonparsed_size()
  // are both at their "safe" values here, isolating the peak conjunct.
  {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    CHECK_MSG(!parser.atSafeShrinkPoint(),
             "fresh parser must not report a safe shrink point");
    for (int i = 0; i < 3; ++i) {
      Bytes frame = buildFrame(packContent([i](auto &pk) { pk.pack(i); }));
      parser.feed(frame.data(), frame.size(), out);
    }
    CHECK_EQ(out.size(), 3u);
    CHECK_MSG(!parser.atSafeShrinkPoint(),
             "small frames only must not report a safe shrink point");
  }

  // (2) state_ == needContent: the header of a large frame has been consumed
  // and its content is still arriving. peakFrameSize_ is already big and
  // nonparsed_size() is 0, so only the state conjunct holds this false.
  // Shrinking here would discard declaredSize_/consumedAtHeader_ mid-frame.
  {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    parser.feed(bigHeader.data(), bigHeader.size(), out);
    CHECK_EQ(out.size(), 0u);
    CHECK_MSG(!parser.atSafeShrinkPoint(),
             "mid-frame (header read, content pending) must not be a safe "
             "shrink point");
    // Partway into the content is equally unsafe.
    parser.feed(bigContent.data(), 1024, out);
    CHECK_MSG(!parser.atSafeShrinkPoint(),
             "mid-frame (content partially buffered) must not be a safe "
             "shrink point");
    // Finishing the frame gets us back to a genuinely safe point, proving the
    // negatives above are not just an always-false stub.
    parser.feed(bigContent.data() + 1024, bigContent.size() - 1024, out);
    CHECK_EQ(out.size(), 1u);
    CHECK_MSG(parser.atSafeShrinkPoint(),
             "a completed big frame must be a safe shrink point");
  }

  // (3) nonparsed_size() != 0: a complete big frame followed by the first two
  // bytes of the next frame's production 5-byte header. state_ is needSize and
  // peakFrameSize_ is big, so only the nonparsed_size conjunct holds this
  // false. reset()ing here would drop those two buffered bytes and desync.
  {
    FrameParser parser;
    std::vector<msgpack::object_handle> out;
    parser.feed(bigFrame.data(), bigFrame.size(), out);
    CHECK_EQ(out.size(), 1u);
    CHECK_MSG(parser.atSafeShrinkPoint(), "setup: expected a safe shrink point");

    Bytes nextFrame = buildFrameProdHeader(contentSmallMap());
    parser.feed(nextFrame.data(), 2, out);
    CHECK_EQ(out.size(), 1u);
    CHECK_MSG(!parser.atSafeShrinkPoint(),
             "a partially buffered next header must not be a safe shrink "
             "point");

    // And the withheld bytes really were load-bearing: the frame completes.
    parser.feed(nextFrame.data() + 2, nextFrame.size() - 2, out);
    CHECK_EQ(out.size(), 2u);
  }
}

void testRecoveryFromPartialStaleFrameAfterReset() {
  // The existing recovery tests feed complete, well-formed frames after
  // reset(). Real recovery is messier: the tail of the frame that desynced us
  // is still draining out of the dead connection, so the first bytes after
  // reset() are mid-frame garbage rather than a header. This is exactly the
  // case the content-length check (`consumed != declaredSize_`) exists for --
  // a byte inside a payload can parse as a perfectly plausible fixint header,
  // and only the length check stops whatever follows it from being handed to
  // JS as a real [type, seqid, ...] message.
  FrameParser parser;
  std::vector<msgpack::object_handle> out;

  auto strContent = [](const std::string &s) {
    return packContent([&s](auto &pk) { pk.pack(s); });
  };
  const std::string kGoodOne = "good-one";
  const std::string kGoodTwo = "good-two";
  const std::string kGarbage = "GARBAGE";

  // A good frame lands first, so we can prove nothing already delivered gets
  // clobbered by the recovery path either.
  Bytes g1 = buildFrame(strContent(kGoodOne));
  parser.feed(g1.data(), g1.size(), out);
  CHECK_EQ(out.size(), 1u);

  // Now the stream desyncs. The trigger is deliberately the *header-type*
  // check rather than the length check, so that this test's real assertion
  // (below: nothing bogus is ever delivered) is what fails if the length check
  // is removed -- not this setup step.
  Bytes bad = headerAsString();
  bool threw = false;
  try {
    parser.feed(bad.data(), bad.size(), out);
  } catch (const std::runtime_error &) {
    threw = true;
  }
  CHECK_MSG(threw, "setup: expected the corrupt header to throw");
  CHECK_EQ(out.size(), 1u);

  parser.reset();

  // The tail of that dead frame is still arriving. Its leading byte is a bare
  // fixint 3 -- a syntactically valid header declaring 3 bytes -- followed by
  // an 8-byte string. If the length check were dropped, "GARBAGE" would be
  // delivered as an RPC message.
  Bytes garbage = strContent(kGarbage);
  CHECK_EQ(garbage.size(), 8u);
  Bytes staleTail;
  staleTail.push_back(0x03);
  staleTail.insert(staleTail.end(), garbage.begin(), garbage.end());

  Bytes g2 = buildFrame(strContent(kGoodTwo));
  Bytes tailThenGood = staleTail;
  tailThenGood.insert(tailThenGood.end(), g2.begin(), g2.end());

  bool rejected = false;
  try {
    parser.feed(tailThenGood.data(), tailThenGood.size(), out);
  } catch (const std::runtime_error &e) {
    rejected = true;
    CHECK_MSG(std::string(e.what()).find("rpc frame") != std::string::npos,
             std::string("unexpected message: ") + e.what());
  }

  // The parser may reject cleanly or resync -- both are acceptable. What is
  // never acceptable is delivering the stale tail as a message.
  for (size_t i = 0; i < out.size(); ++i) {
    const auto &o = out[i].get();
    CHECK_MSG(o.type == msgpack::type::STR,
             "delivered a non-string object at index " + std::to_string(i));
    std::string s(o.via.str.ptr, o.via.str.size);
    CHECK_MSG(s == kGoodOne || s == kGoodTwo,
             "delivered garbage as an rpc message: " + s);
  }

  // After the caller does what production does on a framing error -- reset and
  // keep going -- the stream must be usable again.
  if (rejected) {
    parser.reset();
    const size_t before = out.size();
    parser.feed(g2.data(), g2.size(), out);
    CHECK_EQ(out.size(), before + 1u);
    const auto &o = out.back().get();
    CHECK(o.type == msgpack::type::STR);
    CHECK(std::string(o.via.str.ptr, o.via.str.size) == kGoodTwo);
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
  runner.add("frame_split_at_every_byte_boundary_uint16_header",
            testFrameSplitAtEveryByteBoundaryUint16Header);
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
  runner.add("unbounded_buffering_rejected_by_slack_guard",
            testUnboundedBufferingRejectedBySlackGuard);
  runner.add("safe_shrink_point_false_when_unsafe",
            testSafeShrinkPointFalseWhenUnsafe);
  runner.add("recovery_after_error_and_reset", testRecoveryAfterErrorAndReset);
  runner.add("recovery_from_partial_stale_frame_after_reset",
            testRecoveryFromPartialStaleFrameAfterReset);
  runner.add("reset_then_buffer_growth", testResetThenBufferGrowth);
  runner.add("buffer_shrink_fires_and_arithmetic_holds_after_shrink",
            testBufferShrinkFiresAndArithmeticHoldsAfterShrink);
  runner.add("nested_and_empty_containers_roundtrip",
            testNestedAndEmptyContainersRoundtrip);
  return runner.run();
}
