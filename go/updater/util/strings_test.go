// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"strings"
	"testing"
)

func TestJoinPredicate(t *testing.T) {
	f := func(s string) bool { return strings.HasPrefix(s, "f") }
	s := JoinPredicate([]string{"foo", "bar", "faa"}, "-", f)
	if s != "foo-faa" {
		t.Errorf("Unexpected output: %s", s)
	}
}
