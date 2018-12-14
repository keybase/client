// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

func CheckTracking(g *GlobalContext) error {
	// If we load a UPAK with the ForcePoll(true) flag, we're going to
	// check our local UPAK against the live Merkle tree. On the case of
	// a fresh UPAK, then no op. On the case of a stale UPAK then we trigger
	// a LoadUser, which will send UserChanged as it refreshes.
	m := NewMetaContextBackground(g)
	arg := NewLoadUserArgWithMetaContext(m).WithUID(m.CurrentUID()).WithSelf(true).WithForcePoll(true)
	_, _, err := g.GetUPAKLoader().LoadV2(arg)
	return err
}
