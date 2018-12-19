// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

import (
	"testing"
	"time"
)

func testTimePacking(t *testing.T, t0 time.Time) {
	t1 := unpackTime(packTime(t0))
	if !t0.Equal(t1) {
		t.Fatalf("Time pack+unpack not equal with original: %v => %v", t0, t1)
	}
}

func TestTimePacking(t *testing.T) {
	testTimePacking(t, time.Time{})
	testTimePacking(t, time.Now())
	testTimePacking(t, time.Unix(0, 0))
}

func TestCtxAlloc(t *testing.T) {
	ctx := allocCtx(0)
	ctx.Free()
}
