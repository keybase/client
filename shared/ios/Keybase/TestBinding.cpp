//
//  TestBinding.cpp
//  Keybase
//
//  Created by Chris Nojima on 2/14/20.
//  Copyright © 2020 Keybase. All rights reserved.
//

#include "TestBinding.h"

#include "Test.h"
#include <jsi/JSIDynamic.h>

namespace example {

  static jsi::Object getModule(
                                jsi::Runtime &runtime,
                                const std::string &moduleName) {
    auto batchedBridge =
    runtime.global().getPropertyAsObject(runtime, "__fbBatchedBridge");
    auto getCallableModule =
    batchedBridge.getPropertyAsFunction(runtime, "getCallableModule");
    auto module = getCallableModule
    .callWithThis(
                  runtime,
                  batchedBridge,
                  {jsi::String::createFromUtf8(runtime, moduleName)})
    .asObject(runtime);
    return module;
  }

  void TestBinding::install(
                                  jsi::Runtime &runtime,
                                  std::shared_ptr<TestBinding> testBinding) {
    auto testModuleName = "nativeTest";
    auto object = jsi::Object::createFromHostObject(runtime, testBinding);
    runtime.global().setProperty(runtime, testModuleName, std::move(object));
  }

  TestBinding::TestBinding(std::unique_ptr<Test> test)
  : test_(std::move(test)) {}

  jsi::Value TestBinding::get(
                                    jsi::Runtime &runtime,
                                    const jsi::PropNameID &name) {
    auto methodName = name.utf8(runtime);
    auto &test = *test_;

    if (methodName == "runTest") {
      return jsi::Function::createFromHostFunction(runtime, name, 0, [&test](
                                                                              jsi::Runtime &runtime,
                                                                              const jsi::Value &thisValue,
                                                                              const jsi::Value *arguments,
                                                                              size_t count) -> jsi::Value {
        return test.runTest();
      });
    }

    return jsi::Value::undefined();
  }

} // namespace example
