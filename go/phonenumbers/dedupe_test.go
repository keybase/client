// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package phonenumbers

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestDedupeSupersededPrefersLiveRow(t *testing.T) {
	a := keybase1.PhoneNumber("+15555550123")
	b := keybase1.PhoneNumber("+15555550124")
	rows := []keybase1.UserPhoneNumber{
		{PhoneNumber: a, Superseded: true, Verified: true},
		{PhoneNumber: b, Superseded: false},
		{PhoneNumber: a, Superseded: false, Verified: false},
		{PhoneNumber: a, Superseded: true},
	}
	require.Equal(t, []keybase1.UserPhoneNumber{
		{PhoneNumber: a, Superseded: false, Verified: false},
		{PhoneNumber: b, Superseded: false},
	}, DedupeSuperseded(rows))
}

func TestDedupeSupersededKeepsOnlySupersededRow(t *testing.T) {
	a := keybase1.PhoneNumber("+15555550123")
	rows := []keybase1.UserPhoneNumber{
		{PhoneNumber: a, Superseded: true, Verified: true},
		{PhoneNumber: a, Superseded: true},
	}
	require.Equal(t, rows[:1], DedupeSuperseded(rows))
	require.Nil(t, DedupeSuperseded(nil))
}
