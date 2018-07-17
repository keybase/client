package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"testing"
)

func assertEmail(t *testing.T, g *libkb.GlobalContext, expected string) {
	m := libkb.NewMetaContextBackground(g)
	res, err := g.API.Get(m, libkb.APIArg{
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

	assertEmail(t, tc.G, u.Email)

	newEmail := "new-" + u.Email
	arg := &keybase1.EmailChangeArg{
		NewEmail: newEmail,
	}

	// using an empty secret ui to make sure existing pp doesn't come from ui prompt:
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	eng := NewEmailChange(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	assertEmail(t, tc.G, newEmail)
}
