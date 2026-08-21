// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func fakeUser(tb libkb.TestingTB, prefix string) (username, email string) {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		require.NoError(tb, err)
	}
	username = fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email = fmt.Sprintf("test+%s@keybase.io", username)
	return username, email
}

func fakePassphrase(t libkb.TestingTB) string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		require.NoError(t, err)
	}
	return hex.EncodeToString(buf)
}
