// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package saltpackkeys

import "github.com/keybase/client/go/libkb"

func NewRecipientKeyfinderEngineHook(getKBFSKeyfinderForTesting bool) func(arg libkb.SaltpackRecipientKeyfinderArg) libkb.SaltpackRecipientKeyfinderEngineInterface {
	if getKBFSKeyfinderForTesting {
		return NewSaltpackKBFSKeyfinderEngineForTesting
	}
	return NewSaltpackRecipientKeyfinderEngineAsInterface
}
