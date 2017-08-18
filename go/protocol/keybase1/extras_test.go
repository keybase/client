// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

// IsUser and co. should return false and
// not crash on arbitrary input.
func TestUserOrTeamIDChecking(t *testing.T) {
	var invalidIDTestCases = [6]string{
		"", "    ", "%%@#$", "223123",
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	}
	var validUserIDTestCases = [4]string{
		"bd9e818f230819d3ecc813522c71f600",
		"bd9e818f230819d3ecc813522c71f619",
		"2721c9d9a247028cf51efa0760af6d00",
		"2721c9d9a247028cf51efa0760af6d19",
	}
	var validTeamIDTestCases = [2]string{
		"bd9e818f230819d3ecc813522c71f624",
		"2721c9d9a247028cf51efa0760af6d24",
	}
	var validSubteamIDTestCases = [2]string{
		"bd9e818f230819d3ecc813522c71f625",
		"2721c9d9a247028cf51efa0760af6d25",
	}

	for _, idCase := range invalidIDTestCases {
		ut := UserOrTeamID(idCase)
		if ut.IsUser() || ut.IsTeam() || ut.IsSubteam() || ut.IsTeamOrSubteam() {
			t.Errorf("Invalid ID %s is incorrectly marked valid.", idCase)
		}
	}
	for _, idCase := range validUserIDTestCases {
		ut := UserOrTeamID(idCase)
		if !ut.IsUser() {
			t.Errorf("Valid UserID %s is incorrectly marked invalid.", idCase)
		}
		if ut.IsTeam() || ut.IsSubteam() || ut.IsTeamOrSubteam() {
			t.Errorf("Valid UserID %s is incorrectly marked as valid for another kind of ID.", idCase)
		}
	}
	for _, idCase := range validTeamIDTestCases {
		ut := UserOrTeamID(idCase)
		if !ut.IsTeam() || !ut.IsTeamOrSubteam() {
			t.Errorf("Valid TeamID %s is incorrectly marked invalid.", idCase)
		}
		if ut.IsUser() || ut.IsSubteam() {
			t.Errorf("Valid TeamID %s is incorrectly marked as valid for another kind of ID.", idCase)
		}
	}
	for _, idCase := range validSubteamIDTestCases {
		ut := UserOrTeamID(idCase)
		if !ut.IsSubteam() || !ut.IsTeamOrSubteam() {
			t.Errorf("Valid SubteamID %s is incorrectly marked invalid.", idCase)
		}
		if ut.IsUser() || ut.IsTeam() {
			t.Errorf("Valid SubteamID %s is incorrectly marked as valid for another kind of ID.", idCase)
		}
	}
}
