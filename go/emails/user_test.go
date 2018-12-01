// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
package emails

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
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

func randomEmailAddress(t *testing.T) keybase1.EmailAddress {
	buf := make([]byte, 5)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	email := fmt.Sprintf("%s@example.org", hex.EncodeToString(buf))
	return keybase1.EmailAddress(email)
}

func autoverifyEmail(mctx libkb.MetaContext, email keybase1.EmailAddress) error {
	payload := make(libkb.JSONPayload)
	payload["email"] = email

	arg := libkb.APIArg{
		Endpoint:    "test/verify_email_auto",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	err := mctx.G().API.PostJSON(arg)
	return err
}

func TestEmailHappyPath(t *testing.T) {
	tc := libkb.SetupTest(t, "TestEmailHappyPath", 1)
	defer tc.Cleanup()

	me, err := kbtest.CreateAndSignupFakeUser("emai", tc.G)
	require.NoError(t, err)

	email1 := randomEmailAddress(t)
	email2 := randomEmailAddress(t)
	require.NotEqual(t, email1, email2)

	mctx := libkb.NewMetaContextForTest(tc)

	err = AddEmail(mctx, email1, keybase1.IdentityVisibility_PUBLIC)
	fmt.Println(err)
	require.NoError(t, err)

	err = EditEmail(mctx, email1, email2)
	require.NoError(t, err)

	emails, err := GetEmails(mctx)
	require.NoError(t, err)

	var oldPrimary keybase1.EmailAddress

	require.Len(t, emails, 2)
	found := false
	for _, email := range emails {
		require.NotEqual(t, email.Email, email1)
		if email.Email == email2 {
			found = true
			require.False(t, email.IsVerified)
			require.False(t, email.IsPrimary)
		}
		if email.IsPrimary {
			oldPrimary = email.Email
		}
	}
	require.True(t, found)

	err = SetPrimaryEmail(mctx, email2)
	require.NoError(t, err)

	emails, err = GetEmails(mctx)
	require.NoError(t, err)

	found = false
	for _, email := range emails {
		if email.Email == email2 {
			found = true
			require.True(t, email.IsPrimary)
		}
	}
	require.True(t, found)

	err = SetPrimaryEmail(mctx, oldPrimary)
	require.NoError(t, err)

	err = DeleteEmail(mctx, email2)
	require.NoError(t, err)

	emails, err = GetEmails(mctx)
	require.NoError(t, err)

	found = false
	for _, email := range emails {
		if email.Email == email2 {
			found = true
		}
	}
	require.False(t, found)

	err = autoverifyEmail(oldPrimary)
	require.NoError(t, err)

	contactList := []string{
		"notanemail",
		string(email1),
		string(email2),
		string(oldPrimary),
		"avalid@email.com",
	}
	resolutions, err := BulkLookupEmails(mctx, contactList)
	require.NoError(t, err)

	expectedResolutions := []keybase1.EmailLookupResult{
		keybase1.EmailLookupResult{Uid: nil, EmailAddress: "notanemail"},
		keybase1.EmailLookupResult{Uid: nil, EmailAddress: string(email1)},
		keybase1.EmailLookupResult{Uid: nil, EmailAddress: string(email2)},
		keybase1.EmailLookupResult{Uid: me.UID, EmailAddress: string(oldPrimary)},
		keybase1.EmailLookupResult{Uid: nil, EmailAddress: "avalid@email.com"},
	}

	require.Equal(t, resolutions, expectedResolutions)

	fmt.Println(contactList)
	fmt.Println(resolutions)
	TODO
}
