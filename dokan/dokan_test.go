// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

import (
	"testing"
	"time"
)

func TestTimePacking(t *testing.T) {
	t0 := time.Now()
	if !t0.Equal(unpackTime(packTime(t0))) {
		t.Fatal("Time unpack+pack not equal with original!")
	}
}

func TestCtxAlloc(t *testing.T) {
	ctx := allocCtx(0)
	ctx.Free()
}
