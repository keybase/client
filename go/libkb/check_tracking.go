// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

func CheckTracking(g *GlobalContext) error {
	// LoadUser automatically fires off UserChanged notifications when it
	// discovers new track or untrack chain links.
	arg := NewLoadUserArg(g)
	arg.AbortIfSigchainUnchanged = true
	_, err := LoadMe(arg)
	return err
}
