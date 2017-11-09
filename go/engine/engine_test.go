// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/libkb"
)

func fakeUser(tb libkb.TestingTB, prefix string) (username, email string) {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		tb.Fatal(err)
	}
	username = fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email = fmt.Sprintf("test+%s@keybase.io", username)
	return username, email
}

func fakePassphrase(t libkb.TestingTB) string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	return hex.EncodeToString(buf)
}
