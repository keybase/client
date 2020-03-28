// Copyright (c) Facebook, Inc. and its affiliates.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include "rsocket/internal/KeepaliveTimer.h"

namespace rsocket {

KeepaliveTimer::KeepaliveTimer(
    std::chrono::milliseconds period,
    folly::EventBase& eventBase)
    : eventBase_(eventBase),
      generation_(std::make_shared<uint32_t>(0)),
      period_(period) {}

KeepaliveTimer::~KeepaliveTimer() {
  stop();
}

std::chrono::milliseconds KeepaliveTimer::keepaliveTime() const {
  return period_;
}

void KeepaliveTimer::schedule() {
  const auto scheduledGeneration = *generation_;
  const auto generation = generation_;
  eventBase_.runAfterDelay(
      [this, generation, scheduledGeneration]() {
        if (*generation == scheduledGeneration) {
          sendKeepalive();
        }
      },
      static_cast<uint32_t>(keepaliveTime().count()));
}

void KeepaliveTimer::sendKeepalive() {
  if (pending_) {
    // Make sure connection_ is not deleted (via external call to stop)
    // while we still mid-operation
    const auto localPtr = connection_;
    stop();
    // TODO: we need to use max lifetime from the setup frame for this
    localPtr->disconnectOrCloseWithError(
        Frame_ERROR::connectionError("no response to keepalive"));
  } else {
    // this must happen before sendKeepalive as it can potentially result in
    // stop() being called
    pending_ = true;
    connection_->sendKeepalive();
    schedule();
  }
}

// must be called from the same thread as start
void KeepaliveTimer::stop() {
  *generation_ += 1;
  pending_ = false;
  connection_.reset();
}

// must be called from the same thread as stop
void KeepaliveTimer::start(const std::shared_ptr<FrameSink>& connection) {
  connection_ = connection;
  *generation_ += 1;
  DCHECK(!pending_);

  schedule();
}

void KeepaliveTimer::keepaliveReceived() {
  pending_ = false;
}
} // namespace rsocket
