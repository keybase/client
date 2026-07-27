#include "frame-parser.h"
#include <algorithm>
#include <stdexcept>

namespace kb {

void FrameParser::feed(const uint8_t *data, size_t size,
                       std::vector<msgpack::object_handle> &out) {
  unpacker_.reserve_buffer(size);
  std::memcpy(unpacker_.buffer(), data, size);
  unpacker_.buffer_consumed(size);
  totalFed_ += size;

  while (true) {
    msgpack::object_handle result;
    if (!unpacker_.next(result)) {
      break;
    }
    if (state_ == ReadState::needSize) {
      // The framing prefix must be a msgpack uint. Anything else means the
      // stream desynced; without this check the parity flips and every
      // later frame is silently swallowed as a "size".
      const auto &o = result.get();
      if (o.type != msgpack::type::POSITIVE_INTEGER ||
          o.as<uint64_t>() > kMaxFrameSize) {
        throw std::runtime_error("bad rpc frame header");
      }
      declaredSize_ = static_cast<size_t>(o.as<uint64_t>());
      peakFrameSize_ = std::max(peakFrameSize_, declaredSize_);
      consumedAtHeader_ = totalFed_ - unpacker_.nonparsed_size();
      state_ = ReadState::needContent;
    } else {
      // The header is only a plausibility check on its own: a fixint sitting
      // inside a string payload parses as a valid header after a resync.
      // Requiring the content object to consume exactly the declared byte
      // count makes the framing self-checking, so a truncated or overlong
      // frame is caught here instead of being handed to JS as a bogus
      // [type, seqid, ...].
      //
      // parsed_size() is NOT usable here: unpacker::next() resets it to 0 on
      // every successful parse, so it can't measure a span across two next()
      // calls. totalFed - nonparsed_size() is a genuine monotonic count of
      // bytes consumed from the stream.
      const size_t consumed =
          (totalFed_ - unpacker_.nonparsed_size()) - consumedAtHeader_;
      if (consumed != declaredSize_) {
        throw std::runtime_error("rpc frame length mismatch");
      }
      out.push_back(std::move(result));
      state_ = ReadState::needSize;
    }
  }

  if (unpacker_.nonparsed_size() > kMaxFrameSize + kMaxFrameSlack) {
    throw std::runtime_error("rpc frame exceeds size limit");
  }
}

void FrameParser::reset() {
  unpacker_ = msgpack::unpacker();
  state_ = ReadState::needSize;
  declaredSize_ = 0;
  consumedAtHeader_ = 0;
  totalFed_ = 0;
  peakFrameSize_ = 0;
}

bool FrameParser::atSafeShrinkPoint() const {
  return state_ == ReadState::needSize && unpacker_.nonparsed_size() == 0 &&
         peakFrameSize_ > kRecvBufKeepCapacity;
}

} // namespace kb
