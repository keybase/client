// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase1

import (
	"errors"
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

func TestMDGetBehavior(t *testing.T) {
	// Makes sure any potential addition to the MDGetBehavior enum without
	// extending ShouldCreateClassicTLF would fail on CI, so that we don't
	// panic elsewhere.
	for _, b := range MDGetBehaviorMap {
		b.ShouldCreateClassicTLF()
	}
}

func TestTeamNameFromString(t *testing.T) {
	formatMsg := "Keybase team names must be letters (a-z), numbers, and underscores. Also, they can't start with underscores or use double underscores, to avoid confusion."
	subteamMsg := "Could not parse name as team; bad name component "
	lenMsg := "team names must be between 2 and 16 characters long"
	emptyMsg := "team names cannot be empty"
	tests := []struct {
		input string
		name  TeamName
		err   error
	}{
		{"aabb", TeamName{Parts: []TeamNamePart{stringToTeamNamePart("aabb")}}, nil},
		{"aa.BB.cc.DD", TeamName{Parts: []TeamNamePart{stringToTeamNamePart("aa"), stringToTeamNamePart("bb"), stringToTeamNamePart("cc"), stringToTeamNamePart("dd")}}, nil},
		{"a & b", TeamName{}, errors.New(formatMsg)},
		{" aa", TeamName{}, errors.New(formatMsg)},
		{"a__a", TeamName{}, errors.New(formatMsg)},
		{"_aa", TeamName{}, errors.New(formatMsg)},
		{"a-a", TeamName{}, errors.New(formatMsg)},
		{"cc.a & b", TeamName{}, errors.New(subteamMsg + "\"a & b\": " + formatMsg)},
		{"", TeamName{}, errors.New(emptyMsg)},
		{"aaa..bbb", TeamName{}, errors.New(subteamMsg + "\"\": " + emptyMsg)},
		{"aabbccddeeff00112233", TeamName{}, errors.New(lenMsg)},
		{"a", TeamName{}, errors.New(lenMsg)},
		{"aa.bb.cc.aabbccddeeff00112233", TeamName{}, errors.New(subteamMsg + "\"aabbccddeeff00112233\": " + lenMsg)},
	}
	for i, tc := range tests {
		nm, err := TeamNameFromString(tc.input)
		if err == nil {
			if tc.err != nil {
				t.Fatalf("expected an error in test case %d", i)
			}
			if nm.IsNil() {
				t.Fatalf("expected a non-nil TeamName since no error in test case %d", i)
			}
			if !nm.Eq(tc.name) {
				t.Fatalf("failed name equality at test case %d", i)
			}
		} else {
			if tc.err == nil {
				t.Fatalf("got an error, but non expected at test case %d", i)
			}
			if tc.err.Error() != err.Error() {
				t.Fatalf("bad error string at test case %d: %s != %s", i, tc.err.Error(), err.Error())
			}
		}
	}
}
