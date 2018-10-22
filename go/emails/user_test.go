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

func TestEmailHappyPath(t *testing.T) {
	tc := libkb.SetupTest(t, "TestEmailHappyPath", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("emai", tc.G)
	require.NoError(t, err)

	email1 := randomEmailAddress(t)
	email2 := randomEmailAddress(t)
	require.NotEqual(t, email1, email2)

	mctx := libkb.NewMetaContextForTest(tc)

	err = AddEmail(mctx, email1)
	require.NoError(t, err)

	err = EditEmail(mctx, email1, email2)
	require.NoError(t, err)

	emails, err := GetEmails(mctx)
	require.NoError(t, err)

	require.Len(t, emails, 2)
	found := false
	for _, email := range emails {
		require.NotEqual(t, email.Email, email1)
		if email.Email == email2 {
			found = true
			require.False(t, email.IsVerified)
			require.False(t, email.IsPrimary)
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
}
