// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
package phonenumbers

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type getCodeResponse struct {
	libkb.AppStatusEmbed
	VerificationCode string `json:"verification_code"`
}

func getVerificationCode(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber) (code string, err error) {
	arg := libkb.APIArg{
		Endpoint:    "test/phone_number_code",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"phone_number": libkb.S{Val: phoneNumber.String()},
		},
	}
	var resp getCodeResponse
	err = mctx.G().API.GetDecode(arg, &resp)
	if err != nil {
		return "", err
	}
	return resp.VerificationCode, nil
}

func TestSetPhoneNumber(t *testing.T) {
	tc := libkb.SetupTest(t, "TestPhoneNumbers", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("phon", tc.G)
	require.NoError(t, err)

	phoneNumber := keybase1.PhoneNumber("+14155552671")

	mctx := libkb.NewMetaContextForTest(tc)

	err = AddPhoneNumber(mctx, phoneNumber)
	require.NoError(t, err)

	code, err := getVerificationCode(mctx, phoneNumber)
	require.NoError(t, err)
	t.Logf("Got verification code: %q", code)

	err = VerifyPhoneNumber(mctx, phoneNumber, code)
	require.NoError(t, err)

	resp, err := GetPhoneNumbers(mctx)
	require.NoError(t, err)

	require.Len(t, resp, 1)
	require.Equal(t, phoneNumber, resp[0].PhoneNumber)
	require.True(t, resp[0].Verified)
}

func TestBadPhoneNumbers(t *testing.T) {
	tc := libkb.SetupTest(t, "TestPhoneNumbers", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("phon", tc.G)
	require.NoError(t, err)

	mctx := libkb.NewMetaContextForTest(tc)
	require.Error(t, AddPhoneNumber(mctx, "14155552671"))
	require.Error(t, AddPhoneNumber(mctx, "014155552671"))
	require.Error(t, AddPhoneNumber(mctx, "784111222"))
}
