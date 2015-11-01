// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package client

import (
	keybase1 "github.com/keybase/client/go/protocol"
)

func promptNewPassphrase() (string, error) {
	arg := keybase1.GetNewPassphraseArg{
		TerminalPrompt: "Pick a new strong passphrase",
		PinentryDesc:   "Pick a new strong passphrase (12+ characters)",
		PinentryPrompt: "New Passphrase",
	}
	res, err := G.UI.GetSecretUI().GetNewPassphrase(arg)
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}
