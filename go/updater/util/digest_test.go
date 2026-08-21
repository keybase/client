// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDigest(t *testing.T) {
	data := []byte("test data\n")
	path, err := WriteTempFile("TestDigest", data, 0o644)
	require.NoError(t, err)
	defer RemoveFileAtPath(path)

	err = CheckDigest("0c15e883dee85bb2f3540a47ec58f617a2547117f9096417ba5422268029f501", path, testLog)
	require.NoError(t, err)

	err = CheckDigest("bad", path, testLog)
	require.Error(t, err)

	err = CheckDigest("", path, testLog)
	require.Error(t, err)
}

func TestDigestInvalidPath(t *testing.T) {
	err := CheckDigest("0c15e883dee85bb2f3540a47ec58f617a2547117f9096417ba5422268029f501", "/tmp/invalidpath", testLog)
	t.Logf("Error: %#v", err)
	require.Error(t, err)
}
