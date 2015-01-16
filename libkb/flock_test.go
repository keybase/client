package libkb

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLockPIDFile(t *testing.T) {
	name := filepath.Join(os.TempDir(), "TestLockPID")
	err := LockPIDFile(name)
	if err != nil {
		t.Fatalf("LockPIDFile failed for %q: %v", name, err)
	}
	defer os.Remove(name)

	err = LockPIDFile(name)
	if err == nil {
		t.Fatalf("Second LockPIDFile call succeeded.  It should have failed.")
	}
}
