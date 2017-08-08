// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"bytes"
	"context"
	"testing"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/stretchr/testify/require"
)

func TestCapabilities(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	input := bytes.NewBufferString("capabilities\n\n")
	var output bytes.Buffer
	err := processCommands(context.Background(), config, input, &output)
	require.NoError(t, err)
	require.Equal(t, output.String(), "\n\n")
}
