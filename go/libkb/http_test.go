package libkb

import (
	"testing"
	"testing/quick"
)

func TestHexEncoding(t *testing.T) {
	f := func(x uint64) bool {
		u := UHex{Val: x}
		s := u.String()
		return len(s) == 16
	}
	if err := quick.Check(f, nil); err != nil {
		t.Error(err)
	}
}
