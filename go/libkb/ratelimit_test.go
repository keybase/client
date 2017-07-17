// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
	"time"
)

func TestRateLimit(t *testing.T) {
	limits := NewRateLimits(G)
	if !limits.GetPermission(TestEventRateLimit, 1*time.Minute) {
		t.Fatal("expected to get permission")
	}
	if !limits.GetPermission(TestEventRateLimit, 0) {
		t.Fatal("expected to get permission again with a zero interval")
	}
	if limits.GetPermission(TestEventRateLimit, 1*time.Minute) {
		t.Fatal("expected not to get permission with a long interval")
	}
}
