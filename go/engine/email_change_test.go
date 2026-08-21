package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func assertEmail(mctx libkb.MetaContext, t *testing.T, expected string) {
	res, err := mctx.G().API.Get(mctx, libkb.APIArg{
		Endpoint:    "me",
		SessionType: libkb.APISessionTypeREQUIRED,
	})
	require.NoError(t, err)
	gotten, err := res.Body.AtPath("me.emails.primary.email").GetString()
	require.NoError(t, err)
	require.Equal(t, expected, gotten, "wanted email '%s', but got '%s'", expected, gotten)
}

func TestSignedEmailChange(t *testing.T) {
	tc := SetupEngineTest(t, "EmailChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "email")

	m := NewMetaContextForTest(tc)
	assertEmail(m, t, u.Email)

	newEmail := "new-" + u.Email
	arg := &keybase1.EmailChangeArg{
		NewEmail: newEmail,
	}

	// using an empty secret ui to make sure existing pp doesn't come from ui prompt:
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	m = m.WithUIs(uis)
	eng := NewEmailChange(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}
	assertEmail(m, t, newEmail)
}
