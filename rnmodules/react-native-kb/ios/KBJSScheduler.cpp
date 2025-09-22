// https://github.com/software-mansion/react-native-reanimated/blob/main/Common/cpp/Tools/
#include "./KBJSScheduler.h"
using namespace facebook;
using namespace react;

KBJSScheduler::KBJSScheduler( jsi::Runtime &rnRuntime, const std::shared_ptr<CallInvoker> &jsCallInvoker)
    : scheduleOnJS([&](KBJob job) {
        jsCallInvoker_->invokeAsync(
            [job = std::move(job), &rt = rnRuntime_] { job(rt); });
      }),
      rnRuntime_(rnRuntime),
      jsCallInvoker_(jsCallInvoker) {}

// With `runtimeExecutor`.
KBJSScheduler::KBJSScheduler( jsi::Runtime &rnRuntime, RuntimeExecutor runtimeExecutor)
    : scheduleOnJS([&](KBJob job) {
        runtimeExecutor_(
            [job = std::move(job)](jsi::Runtime &runtime) { job(runtime); });
      }),
      rnRuntime_(rnRuntime),
      runtimeExecutor_(runtimeExecutor) {}

const std::shared_ptr<CallInvoker> KBJSScheduler::getJSCallInvoker() const {
  assert( jsCallInvoker_ != nullptr && " Expected jsCallInvoker, got nullptr instead.");
  return jsCallInvoker_;
}
