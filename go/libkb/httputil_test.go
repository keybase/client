// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDiscardAndCloseBody(t *testing.T) {
	err := DiscardAndCloseBody(nil)
	require.Error(t, err)
}
