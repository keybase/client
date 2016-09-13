// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package go;

import android.test.InstrumentationTestCase;

import org.golang.custompkg.testpkg.Testpkg;

public class CustomPkgTest extends InstrumentationTestCase {
  public void testHi() {
    Testpkg.hi();
  }
}
