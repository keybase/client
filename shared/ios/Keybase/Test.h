//
//  Test.h
//  Keybase
//
//  Created by Chris Nojima on 2/14/20.
//  Copyright © 2020 Keybase. All rights reserved.
//

#pragma once

#include <jsi/jsi.h>

namespace example {

  class Test {
  private:
    friend class TestBinding;

    int runTest() const;
  };

} // namespace example
