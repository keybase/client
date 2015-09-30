package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"
)

func fakeUser(tb testing.TB, prefix string) (username, email string) {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		tb.Fatal(err)
	}
	username = fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email = fmt.Sprintf("test+%s@keybase.io", username)
	return username, email
}

func fakePassphrase(t testing.TB) string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	return hex.EncodeToString(buf)
}
