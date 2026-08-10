// Unit tests for kb::EngineResetEmitBackoff (cpp/engine-reset-backoff.h), the
// kb-engine-reset emit throttle used by ios/Kb.mm's ReadArr loop. The clock is
// passed in, so every window is stepped exactly rather than slept through.
//
// Mirror of android/src/test/java/com/reactnativekb/ReadLoopThrottlesTest.kt --
// the two platforms must agree.

#include "../engine-reset-backoff.h"
#include "test-harness.h"

using kb::EngineResetEmitBackoff;

namespace {

constexpr double kInitial = EngineResetEmitBackoff::kInitialSeconds;
constexpr double kCeiling = EngineResetEmitBackoff::kCeilingSeconds;
// One reader-loop retry tick (the loop sleeps 0.1s between failed reads).
constexpr double kTick = 0.1;

void firstFailureEmitsImmediately() {
  EngineResetEmitBackoff b;
  CHECK(b.shouldEmit(0, true));
}

void secondEmitIsSuppressedUntilTheWindowElapses() {
  EngineResetEmitBackoff b;
  CHECK(b.shouldEmit(0, true));
  // ~10Hz retry: four more failures inside the first 0.5s window.
  for (int i = 1; i <= 4; ++i) {
    CHECK(!b.shouldEmit(i * kTick, true));
  }
  CHECK(b.shouldEmit(kInitial, true));
}

void intervalDoublesPerEmit() {
  EngineResetEmitBackoff b;
  CHECK(b.shouldEmit(0, true));
  double last = 0;
  for (double want : {0.5, 1.0, 2.0, 4.0}) {
    CHECK_MSG(!b.shouldEmit(last + want * 0.999, true),
              "emit just short of the window should be suppressed");
    CHECK_MSG(b.shouldEmit(last + want, true),
              "emit at the window boundary should be allowed");
    last += want;
  }
}

void clampsAtCeiling() {
  EngineResetEmitBackoff b;
  CHECK(b.shouldEmit(0, true));
  double last = 0;
  double window = kInitial;
  for (int i = 0; i < 20; ++i) {
    last += window;
    CHECK(b.shouldEmit(last, true));
    window = window * 2 < kCeiling ? window * 2 : kCeiling;
  }
  CHECK_EQ(window, kCeiling);
  // The live window really is the ceiling, not something larger.
  CHECK(!b.shouldEmit(last + kCeiling * 0.999, true));
  CHECK(b.shouldEmit(last + kCeiling, true));
}

void resetOnSuccessfulReadEmitsPromptlyAgain() {
  EngineResetEmitBackoff b;
  CHECK(b.shouldEmit(0, true));
  CHECK(b.shouldEmit(0.5, true)); // backoff now 1.0s
  b.reset();                      // a successful read landed
  // A later, unrelated episode notifies JS immediately and starts over at the
  // initial interval rather than resuming at 2.0s.
  CHECK(b.shouldEmit(0.6, true));
  CHECK(!b.shouldEmit(0.6 + kInitial * 0.999, true));
  CHECK(b.shouldEmit(0.6 + kInitial, true));
}

void undeliverableDoesNotAdvanceTheBackoff() {
  EngineResetEmitBackoff b;
  // A whole episode's worth of failures while JS can't receive them (reload in
  // flight): none may cost a backoff window.
  double now = 0;
  for (int i = 0; i < 100; ++i) {
    now += kTick;
    CHECK(!b.shouldEmit(now, false));
  }
  // The moment JS can receive again the very next failure emits immediately,
  // not after a multi-second window...
  CHECK(b.shouldEmit(now, true));
  // ...and it is the FIRST emit, so the window that follows is the initial
  // one, not a ceiling-sized one grown by the undeliverable run.
  CHECK(!b.shouldEmit(now + kInitial * 0.999, true));
  CHECK(b.shouldEmit(now + kInitial, true));
}

void undeliverableDuringAnOpenWindowStillDoesNotAdvance() {
  EngineResetEmitBackoff b;
  CHECK(b.shouldEmit(0, true)); // window 0.5s
  CHECK(!b.shouldEmit(0.5, false)); // open again, but nothing to deliver to
  // The open window must survive: the next deliverable failure emits.
  CHECK(b.shouldEmit(0.5, true));
}

} // namespace

int main() {
  kbtest::Runner r;
#define ADD(fn) r.add(#fn, fn)
  ADD(firstFailureEmitsImmediately);
  ADD(secondEmitIsSuppressedUntilTheWindowElapses);
  ADD(intervalDoublesPerEmit);
  ADD(clampsAtCeiling);
  ADD(resetOnSuccessfulReadEmitsPromptlyAgain);
  ADD(undeliverableDoesNotAdvanceTheBackoff);
  ADD(undeliverableDuringAnOpenWindowStillDoesNotAdvance);
#undef ADD
  return r.run();
}
