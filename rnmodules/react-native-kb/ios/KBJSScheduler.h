// https://github.com/software-mansion/react-native-reanimated/blob/main/Common/cpp/Tools/
#pragma once

#include <ReactCommon/CallInvoker.h>
#include <ReactCommon/RuntimeExecutor.h>
#include <jsi/jsi.h>

#include <memory>
#include <utility>

using namespace facebook;
using namespace react;

using KBJob = std::function<void(jsi::Runtime &rt)>;

class KBJSScheduler {
 public:
  // With `jsCallInvoker`.
  explicit KBJSScheduler(
      jsi::Runtime &rnRuntime,
      const std::shared_ptr<CallInvoker> &jsCallInvoker);

#if defined(RCT_NEW_ARCH_ENABLED)
  // With `runtimeExecutor`.
  explicit KBJSScheduler(
      jsi::Runtime &rnRuntime,
      RuntimeExecutor runtimeExecutor);
#endif // REACT_NATIVE_MINOR_VERSION >= 74 && defined(RCT_NEW_ARCH_ENABLED

  const std::function<void(KBJob)> scheduleOnJS = nullptr;
  const std::shared_ptr<CallInvoker> getJSCallInvoker() const;

 protected:
  jsi::Runtime &rnRuntime_;
#if defined(RCT_NEW_ARCH_ENABLED)
  RuntimeExecutor runtimeExecutor_ = nullptr;
#endif // REACT_NATIVE_MINOR_VERSION >= 74 && defined(RCT_NEW_ARCH_ENABLED
  const std::shared_ptr<CallInvoker> jsCallInvoker_ = nullptr;
};
