package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"testing"
)

func assertEmail(mctx libkb.MetaContext, t *testing.T, expected string) {
	res, err := mctx.G().API.Get(mctx, libkb.APIArg{
		Endpoint:    "me",
		SessionType: libkb.APISessionTypeREQUIRED,
	})
	if err != nil {
		t.Fatal(err)
	}
	gotten, err := res.Body.AtPath("me.emails.primary.email").GetString()
	if err != nil {
		t.Fatal(err)
	}
	if gotten != expected {
		t.Fatalf("wanted email '%s', but got '%s'", expected, gotten)
	}
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
		t.Fatal(err)
	}
	assertEmail(m, t, newEmail)
}
