// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSize(t *testing.T) {
	require.Equal(t, UID("a").Size(), 9)
	require.Equal(t, TeamID("a").Size(), 9)
	require.Equal(t, UserOrTeamID("a").Size(), 9)
	kid := KID("a")
	require.Equal(t, kid.Size(), 9)
}
