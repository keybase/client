//
//  TestBinding.hpp
//  Keybase
//
//  Created by Chris Nojima on 2/14/20.
//  Copyright © 2020 Keybase. All rights reserved.
//

#pragma once

#include "Test.h"
#include <jsi/jsi.h>

using namespace facebook;

namespace example {

  /*
    * Exposes Test to JavaScript realm.
    */
  class TestBinding : public jsi::HostObject {
  public:
    /*
      * Installs TestBinding into JavaSctipt runtime.
      * Thread synchronization must be enforced externally.
      */
    static void install(
                        jsi::Runtime &runtime,
                        std::shared_ptr<TestBinding> testBinding);

    TestBinding(std::unique_ptr<Test> test);

    /*
      * `jsi::HostObject` specific overloads.
      */
    jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &name) override;

  private:
    std::unique_ptr<Test> test_;
  };

} // namespace example
