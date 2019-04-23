// +build darwin

package libkb

import (
	"testing"

	"github.com/pkg/xattr"
	"github.com/stretchr/testify/require"
)

func TestSetDisableBackup(t *testing.T) {
	tc := libkb.SetupTest(t, "erasable kv store disable backup", 1)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)

	subDir := ""
	s := NewFileErasableKVStore(mctx, subDir)
	key := "test-key"
	value := "value"

	err = s.Put(mctx, key, value)
	require.NoError(t, err)

	storageDir := getStorageDir(mctx, subDir)
	// Check that we set noBackup on the key
	metadata, err := xattr.Get(storageDir, key)
	require.NoError(t, err)
	require.Equal(t, []byte(noBackup), metadata)

	// Check that we set noBackup on the noise
	metadata, err = xattr.Get(storageDir, key+noiseSuffix)
	require.NoError(t, err)
	require.Equal(t, []byte(noBackup), metadata)
}
