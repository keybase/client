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
  explicit KBJSScheduler( jsi::Runtime &rnRuntime, const std::shared_ptr<CallInvoker> &jsCallInvoker);
  // With `runtimeExecutor`.
  explicit KBJSScheduler( jsi::Runtime &rnRuntime, RuntimeExecutor runtimeExecutor);
  const std::function<void(KBJob)> scheduleOnJS = nullptr;
  const std::shared_ptr<CallInvoker> getJSCallInvoker() const;

 protected:
  jsi::Runtime &rnRuntime_;
  RuntimeExecutor runtimeExecutor_ = nullptr;
  const std::shared_ptr<CallInvoker> jsCallInvoker_ = nullptr;
};
