package libkb

import "testing"

func TestSaferDLLLoading(t *testing.T) {
	err := SaferDLLLoading()
	if err != nil {
		t.Error("SaferDLLLoading error:", err)
	}
}
