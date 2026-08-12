// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestExportUser(t *testing.T) {
	tc := SetupTest(t, "export_user", 1)
	defer tc.Cleanup()
	alice, err := LoadUser(NewLoadUserByNameArg(tc.G, "t_alice"))
	require.NoError(t, err)

	exportedAlice := alice.Export()

	require.Equal(t, "295a7eea607af32040647123732bc819", exportedAlice.Uid.String(), fmt.Sprint("wrong UID", exportedAlice.Uid))

	require.Equal(t, "t_alice", exportedAlice.Username, fmt.Sprint("wrong username", exportedAlice.Username))

	var publicKeys []keybase1.PublicKey
	if alice.GetComputedKeyFamily() != nil {
		publicKeys = alice.GetComputedKeyFamily().Export()
	}

	require.Len(t, publicKeys, 1, fmt.Sprint("expected 1 public key", publicKeys))

	require.Equal(t, "2373fd089f28f328916b88f99c7927c0bdfdadf9", publicKeys[0].PGPFingerprint, fmt.Sprint("wrong fingerprint", publicKeys[0].PGPFingerprint))
}
