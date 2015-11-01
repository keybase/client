// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLockPIDFile(t *testing.T) {
	name := filepath.Join(os.TempDir(), "TestLockPID")
	lock := NewLockPIDFile(name)
	var err error
	if err = lock.Lock(); err != nil {
		t.Fatalf("LockPIDFile failed for %q: %v", name, err)
	}
	defer lock.Close()

	lock2 := NewLockPIDFile(name)
	if err = lock2.Lock(); err == nil {
		t.Fatalf("Second LockPIDFile call succeeded.  It should have failed.")
	}
}
