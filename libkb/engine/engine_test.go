package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"
)

func fakeUser(t *testing.T, prefix string) (username, email string) {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	username = fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email = fmt.Sprintf("test+%s@keybase.io", username)
	return username, email
}

func fakePassphrase(t *testing.T) string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	return hex.EncodeToString(buf)
}

func createFakeUser(t *testing.T, deviceName string) (username, passphrase string) {
	username, email := fakeUser(t, "se")
	passphrase = fakePassphrase(t)

	s := NewSignupEngine(G.UI.GetLogUI(), nil, nil)
	arg := SignupEngineRunArg{username, email, testInviteCode, passphrase, deviceName, true, true}
	if err := s.Run(arg); err != nil {
		t.Fatal(err)
	}
	return username, passphrase
}
