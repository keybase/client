// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"strings"
	"testing"
)

func TestRandString(t *testing.T) {
	s, err := RandomID("prefix=")
	t.Logf("Rand string: %s", s)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(s, "prefix=") {
		t.Errorf("Invalid prefix: %s", s)
	}
	if len(s)-len("prefix.") != 52 {
		t.Errorf("Invalid length: %s (%d)", s, len(s))
	}
}
