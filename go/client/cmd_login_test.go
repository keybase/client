// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"strings"
	"testing"
)

const noMatchGPGSingleOut = `Sorry, your account is already established with a PGP public key, but this
utility cannot find the corresponding private key on this machine.
This is the fingerprint of the PGP key in your account:

   ababababab

You need to prove you're you. We suggest one of the following:

   - put one of the PGP private keys listed above on this machine and try again
   - reset your account and start fresh: https://keybase.io/#account-reset`

const noMatchGPGMultipleOut = `Sorry, your account is already established with PGP public keys, but this
utility cannot find a corresponding private key on this machine.
These are the fingerprints of the PGP keys in your account:

   ababababab
   cdcdcdcdcd

You need to prove you're you. We suggest one of the following:

   - put one of the PGP private keys listed above on this machine and try again
   - reset your account and start fresh: https://keybase.io/#account-reset`

// Test this error message for single and multiple fingerprints.
func TestErrNoMatchingGPGKeys(t *testing.T) {
	c := &CmdLogin{}
	e1 := c.errNoMatchingGPGKeys([]string{"ababababab"})
	if strings.TrimSpace(e1.Error()) != strings.TrimSpace(noMatchGPGSingleOut) {
		t.Errorf("single fingerprint output didn't match:\n%s\n", e1.Error())
	}
	e2 := c.errNoMatchingGPGKeys([]string{"ababababab", "cdcdcdcdcd"})
	if strings.TrimSpace(e2.Error()) != strings.TrimSpace(noMatchGPGMultipleOut) {
		t.Errorf("multiple fingerprint output didn't match:\n%s\n", e2.Error())
	}
}
