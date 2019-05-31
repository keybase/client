// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
package phonenumbers

import (
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestSetPhoneNumber(t *testing.T) {
	tc := libkb.SetupTest(t, "TestPhoneNumbers", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("phon", tc.G)
	require.NoError(t, err)

	// Generate a random phone number e.g. "14155552671".
	randomNumber := kbtest.GenerateTestPhoneNumber()
	// In strict format: "+14155552671".
	phoneNumber := keybase1.PhoneNumber("+" + randomNumber)
	// Create a representation likely to come from phone contact book: "+1-415-555-2671".
	phoneFormatted := keybase1.RawPhoneNumber(fmt.Sprintf("+%s-%s-%s-%s", randomNumber[0:1], randomNumber[1:4], randomNumber[4:7], randomNumber[7:11]))
	// Sanity check.
	require.EqualValues(t, phoneNumber, strings.Replace(string(phoneFormatted), "-", "", -1))

	t.Logf("Generated phone number: %q formatted as %q", phoneNumber, phoneFormatted)

	mctx := libkb.NewMetaContextForTest(tc)

	err = AddPhoneNumber(mctx, phoneNumber, keybase1.IdentityVisibility_PRIVATE)
	require.NoError(t, err)

	code, err := kbtest.GetPhoneVerificationCode(mctx, phoneNumber)
	require.NoError(t, err)
	t.Logf("Got verification code: %q", code)

	err = VerifyPhoneNumber(mctx, phoneNumber, code)
	require.NoError(t, err)
	err = SetVisibilityPhoneNumber(mctx, phoneNumber, keybase1.IdentityVisibility_PUBLIC)
	require.NoError(t, err)

	resp, err := GetPhoneNumbers(mctx)
	require.NoError(t, err)
	require.Len(t, resp, 1)
	require.Equal(t, phoneNumber, resp[0].PhoneNumber)
	require.True(t, resp[0].Verified)

	err = DeletePhoneNumber(mctx, phoneNumber)
	require.NoError(t, err)

	resp, err = GetPhoneNumbers(mctx)
	require.NoError(t, err)
	require.Len(t, resp, 0)
}

func TestBadPhoneNumbers(t *testing.T) {
	tc := libkb.SetupTest(t, "TestPhoneNumbers", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("phon", tc.G)
	require.NoError(t, err)

	mctx := libkb.NewMetaContextForTest(tc)
	require.Error(t, AddPhoneNumber(mctx, "14155552671", keybase1.IdentityVisibility_PUBLIC))
	require.Error(t, AddPhoneNumber(mctx, "014155552671", keybase1.IdentityVisibility_PUBLIC))
	require.Error(t, AddPhoneNumber(mctx, "784111222", keybase1.IdentityVisibility_PUBLIC))
}
