// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase1

import (
	"testing"
	"time"
)

func TestTime(t *testing.T) {
	var time1 time.Time
	kbTime1 := ToTime(time1)
	if kbTime1 != 0 {
		t.Fatalf("Protocol marshaling from zero time failed")
	}
	time2 := FromTime(kbTime1)
	if !time2.IsZero() {
		t.Fatalf("Protocol marshaling to zero time failed")
	}

	now := time.Now()
	kbNow := ToTime(now)
	rev := FromTime(kbNow)

	if rev.Unix() != now.Unix() {
		t.Errorf("keybase time messed up: now = %s, rev = %s", now, rev)
	}
}
