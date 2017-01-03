// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"testing"
)

// runTestWithParallelCopies runs numCopies of the given test function
// in parallel. This is used to induce failures in flaky tests.
func runTestWithParallelCopies(
	t *testing.T, name string, numCopies int, f func(t *testing.T)) {
	for i := 0; i < numCopies; i++ {
		i := i // capture range variable.
		t.Run(fmt.Sprintf("%s(%d)", name, i), func(t *testing.T) {
			t.Parallel()
			f(t)
		})
	}
}
