package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/keybase/go/libkb"
)

func fakeUser(t *testing.T, prefix string) (username, email string) {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	username = fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email = fmt.Sprintf("%s@email.com", username)
	return username, email
}

func TestSignupEngine(t *testing.T) {
	tc := libkb.SetupTest(t, "signup")
	defer tc.Cleanup()
	s := NewSignupEngine(G.UI.GetLogUI())
	username, email := fakeUser(t, "se")
	arg := SignupEngineRunArg{username, email, "202020202020202020202020", "passphrase passphrase", "my device"}
	err := s.Run(arg)
	if err != nil {
		t.Fatal(err)
	}
}
