package client

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSimpleFSPathRemote(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	testPath := makeSimpleFSPath(tc.G, "/keybase/private/foobar")
	pathType, err := testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")
	assert.Equal(tc.T, "/private/foobar", testPath.Kbfs())
}

func TestSimpleFSPathLocal(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	testPath := makeSimpleFSPath(tc.G, "./foobar")
	pathType, err := testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")
}
