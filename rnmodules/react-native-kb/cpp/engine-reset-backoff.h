#pragma once

// Emit backoff for the permanent RPC reader loop (ios/Kb.mm's ReadArr loop).
//
// Header-only, with the clock passed IN rather than read here, so the
// arithmetic is exercisable by a plain unit test (cpp/tests/
// engine-reset-backoff-test.cpp, built by scripts/test-engine-reset-backoff.sh)
// -- the reader loop itself is a blocking, process-lifetime dispatch queue
// that cannot be driven from a test. The Android twin is
// EngineResetEmitThrottle in android/src/main/java/com/reactnativekb/
// ReadLoopThrottles.kt; keep the two in step.

namespace kb {

// Throttles the kb-engine-reset EMIT, separately from the read-error log line
// -- they have different cadences and must not share a counter. JS's
// disconnectCallback does a full session-cancel sweep (with a log of its own)
// and connectCallback re-dispatches the bootstrap path, so a connection that
// cannot be re-dialed must not re-trigger those at the ~10Hz this loop retries
// at. The first failure emits immediately so JS learns promptly; each later
// failure in the same episode backs off exponentially to a ceiling. reset() on
// the next successful read, so a later, unrelated episode again emits
// promptly.
class EngineResetEmitBackoff {
public:
  static constexpr double kInitialSeconds = 0.5;
  static constexpr double kCeilingSeconds = 5.0;

  // `now` must come from a monotonic clock (CACurrentMediaTime, not NSDate):
  // a backward wall-clock correction during a read-error episode (plausible at
  // cold boot) must not push the next allowed emit into the future and
  // suppress the notification entirely.
  //
  // `deliverable` gates the backoff advance itself, not just the emit: an emit
  // that has nowhere to go (no shared instance / can't emit yet) must not cost
  // a full backoff window, or a notification dropped during e.g. a reload
  // delays the next one that could actually be delivered.
  bool shouldEmit(double now, bool deliverable) {
    if (now < notBefore_ || !deliverable) {
      return false;
    }
    backoff_ = backoff_ == 0 ? kInitialSeconds
                             : (backoff_ * 2 < kCeilingSeconds ? backoff_ * 2
                                                               : kCeilingSeconds);
    notBefore_ = now + backoff_;
    return true;
  }

  void reset() {
    backoff_ = 0;
    notBefore_ = 0;
  }

private:
  double backoff_ = 0;
  double notBefore_ = 0;
};

} // namespace kb
