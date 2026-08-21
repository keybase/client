// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSigsList(t *testing.T) {
	tc := SetupEngineTest(t, "sigslist")
	defer tc.Cleanup()

	args := SigsListArgs{Username: "t_alice"}
	eng := NewSigsList(tc.G, args)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	s := eng.Sigs()
	require.Len(t, s, 3, "t_alice sig count: %d, expected 3", len(s))
	for _, s := range eng.Sigs() {
		t.Logf("sig: %+v\n", s)
	}
}
