package libkb

import (
	"crypto/sha256"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestErasableKVStore(t *testing.T) {
	tc := SetupTest(t, "libkb store encryption", 1)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	subDir := ""
	s := NewFileErasableKVStore(mctx, subDir, func(_ MetaContext, noise NoiseBytes) ([32]byte, error) {
		return sha256.Sum256(noise[:]), nil
	})

	key := "test-key.key"
	expected := "value"
	err := s.Put(mctx, key, expected)
	require.NoError(t, err)
	var val string
	err = s.Get(mctx, key, &val)
	require.NoError(t, err)
	require.Equal(t, expected, val)

	// create a tmp file in the storage dir, ensure we clean it up when calling
	// `AllKeys`
	tmp, err := ioutil.TempFile(s.storageDir, key)
	require.NoError(t, err)
	for i := 0; i < 5; i++ {
		keys, err := s.AllKeys(mctx, ".key")
		require.NoError(t, err)
		require.Equal(t, []string{key}, keys)
		exists, err := FileExists(tmp.Name())
		require.NoError(t, err)
		if !exists {
			break
		}
	}

	// Test noise file corruption
	noiseName := fmt.Sprintf("%s%s", key, noiseSuffix)
	storageDir := getStorageDir(mctx, subDir)
	noiseFilePath := filepath.Join(storageDir, noiseName)
	noise, err := ioutil.ReadFile(noiseFilePath)
	require.NoError(t, err)

	// flip one bit
	corruptedNoise := make([]byte, len(noise))
	copy(corruptedNoise, noise)
	corruptedNoise[0] ^= 0x01

	err = ioutil.WriteFile(noiseFilePath, corruptedNoise, PermFile)
	require.NoError(t, err)

	var corrupt string
	err = s.Get(mctx, key, &corrupt)
	require.Error(t, err)
	uerr, ok := err.(UnboxError)
	require.True(t, ok)
	require.Equal(t, fmt.Sprintf("ErasableKVStore UnboxError (info=noise hashes do not match): secretbox.Open failure. Stored noise hash: %x, current noise hash: %x, equal: %v", s.noiseHash(noise), s.noiseHash(corruptedNoise), false), uerr.Error())
	require.NotEqual(t, expected, corrupt)

	err = s.Erase(mctx, key)
	require.NoError(t, err)

	keys, err := s.AllKeys(mctx, ".key")
	require.NoError(t, err)
	require.Equal(t, []string(nil), keys)

	s2 := NewFileErasableKVStore(mctx, "nah", func(_ MetaContext, noise NoiseBytes) ([32]byte, error) {
		return sha256.Sum256(noise[:]), nil
	})
	key2 := "mynewkey"
	expected2 := []byte("yellow_submarine")
	err = s2.Put(mctx, key2, expected2)
	require.NoError(t, err)

	s3 := NewFileErasableKVStore(mctx, "nah", func(_ MetaContext, noise NoiseBytes) ([32]byte, error) {
		return sha256.Sum256(noise[:]), nil
	})
	var val2 []byte
	err = s3.Get(mctx, key2, &val2)
	require.NoError(t, err)
	require.Equal(t, expected2, val2)
}
