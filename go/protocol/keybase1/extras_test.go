// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase1

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
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

func Test0TimeConversion(t *testing.T) {
	require.Equal(t, UnixTime(0), ToUnixTime(time.Time{}))
	require.Equal(t, Time(0), ToTime(time.Time{}))
	require.Equal(t, time.Time{}, FromUnixTime(UnixTime(0)))
	require.Equal(t, time.Time{}, FromTime(Time(0)))
}

func TestTimeConversions(t *testing.T) {
	const longForm = "Jan 2, 2006 at 3:04pm (MST)"
	constTime, err := time.Parse(longForm, "Feb 3, 2013 at 7:54pm (PST)")
	require.NoError(t, err)

	// add an offset to test precision below a second
	constTimeWithOffset := constTime.Add(5 * time.Nanosecond)

	times := []time.Time{
		time.Time{},
		time.Now(),
		time.Now().AddDate(1000, 0, 0),  // in a thousand years
		time.Now().AddDate(10000, 0, 0), // in 10 thousand years
		time.Now().AddDate(-3000, 0, 0), // 3 thousand years ago
		constTime,
		constTime.AddDate(1000, 0, 0),
		constTime.AddDate(10000, 0, 0),
		constTime.AddDate(-3000, 0, 0),
		constTime.Add(12345678 * time.Second),
		constTime.Add(3 * time.Millisecond),
		constTime.Add(3 * time.Nanosecond),
		constTimeWithOffset,
		constTimeWithOffset.AddDate(1000, 0, 0),
		constTimeWithOffset.AddDate(10000, 0, 0),
		constTimeWithOffset.AddDate(-3000, 0, 0),
		constTimeWithOffset.Add(12345678 * time.Second),
	}

	assertTimesEqualSec := func(t1, t2 time.Time) {
		require.Equal(t, t1.Unix(), t2.Unix(), "expected %v and %v to be equal (with up to a second precision)", t1, t2)
	}
	assertTimesEqualMSec := func(t1, t2 time.Time) {
		assertTimesEqualSec(t1, t2)
		require.True(t, (t1.Nanosecond()-t2.Nanosecond()) < 1e6, "expected %v and %v to be equal (with up to a millisecond precision)", t1, t2)
		require.True(t, (t2.Nanosecond()-t1.Nanosecond()) < 1e6, "expected %v and %v to be equal (with up to a millisecond precision)", t1, t2)
	}
	assertTimesEqualStrict := func(t1, t2 time.Time) {
		require.True(t, t1.Equal(t2), "expected %v and %v to be equal", t1, t2)
	}

	for _, tm := range times {
		kbTime := ToTime(tm)
		tRev := FromTime(kbTime)
		// conversion to Time are only precise up to a millisecond
		assertTimesEqualMSec(tm, tRev)
		if tm.Nanosecond() == 0 {
			assertTimesEqualStrict(tm, tRev)
		}

		kbUnixTime := ToUnixTime(tm)
		tUnixRev := FromUnixTime(kbUnixTime)
		// conversion to UnixTime are only precise up to a second
		assertTimesEqualSec(tm, tUnixRev)
		if tm.Nanosecond() == 0 {
			assertTimesEqualStrict(tm, tUnixRev)
		}
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

func TestRedact(t *testing.T) {
	cmd1 := "keybase fs ls anything really here"
	rcmd1 := fmt.Sprintf("keybase fs %s", redactedReplacer)
	arg := ClientDetails{
		Argv: strings.Split(cmd1, " ")}
	arg.Redact()
	require.Equal(t, strings.Split(rcmd1, " "), arg.Argv)

	cmd2 := "keybase whatever command paperkey --another-flag"
	arg = ClientDetails{
		Argv: strings.Split(cmd2, " ")}
	arg.Redact()
	require.Equal(t, strings.Split(cmd2, " "), arg.Argv)
}
