// +build darwin

package libkb

import (
	"crypto/sha256"
	"testing"

	"github.com/pkg/xattr"
	"github.com/stretchr/testify/require"
)

func TestSetDisableBackup(t *testing.T) {
	tc := SetupTest(t, "erasable kv store disable backup", 1)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	subDir := ""
	s := NewFileErasableKVStore(mctx, subDir, func(_ MetaContext, noise NoiseBytes) ([32]byte, error) {
		return sha256.Sum256(noise[:]), nil
	})
	key := "test-key"
	value := "value"

	require.NoError(t, s.Put(mctx, key, value))

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
