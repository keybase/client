package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"testing"
)

func assertEmail(t *testing.T, g *libkb.GlobalContext, expected string) {
	res, err := g.API.Get(libkb.APIArg{
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
	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewEmailChange(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	assertEmail(t, tc.G, newEmail)
}
