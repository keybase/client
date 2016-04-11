// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!android

package libkb

import "os"

func NewSecretStoreAll(g *GlobalContext) SecretStoreAll {
	// In order to not break production build releases, only
	// use the SecretStoreFile on windows and linux if this
	// environment variable is set.
	if os.Getenv("KEYBASE_SECRET_STORE_FILE") != "1" {
		return nil
	}
	return NewSecretStoreFile(g.Env.GetDataDir())
}
