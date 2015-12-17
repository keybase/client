// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/client/go/libkb"
)

// TODO: get rid of this as part of CORE-2205
func promptNewPassphrase() (string, error) {
	res, err := libkb.GetNewPassphrase(G.UI.GetSecretUI())
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}
