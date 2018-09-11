package erasablekv

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestErasableKVStore(t *testing.T) {
	tc := libkb.SetupTest(t, "erasablekv store encryption", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	subDir := ""
	s := NewFileErasableKVStore(tc.G, subDir)
	key := "test-key"
	expected := "value"
	var val string

	err = s.Put(context.Background(), key, expected)
	require.NoError(t, err)

	err = s.Get(context.Background(), key, val)
	require.Error(t, err)
	require.NotEqual(t, expected, val)

	keys, err := s.AllKeys(context.Background())
	require.NoError(t, err)
	require.Equal(t, []string{key}, keys)

	// Test noise file corruption
	noiseName := fmt.Sprintf("%s%s", key, noiseSuffix)
	storageDir := getStorageDir(tc.G, subDir)
	noiseFilePath := filepath.Join(storageDir, noiseName)
	noise, err := ioutil.ReadFile(noiseFilePath)
	require.NoError(t, err)

	// flip one bit
	corruptedNoise := make([]byte, len(noise))
	copy(corruptedNoise, noise)
	corruptedNoise[0] ^= 0x01

	err = ioutil.WriteFile(noiseFilePath, corruptedNoise, libkb.PermFile)
	require.NoError(t, err)

	var corrupt string
	err = s.Get(context.Background(), key, corrupt)
	require.Error(t, err)
	uerr, ok := err.(UnboxError)
	require.True(t, ok)
	require.Equal(t, fmt.Sprintf("ErasableKVStore UnboxError: secretbox.Open failure. Stored noise hash: %x, current noise hash: %x, equal: %v", s.noiseHash(noise), s.noiseHash(corruptedNoise), false), uerr.Error())
	require.NotEqual(t, expected, corrupt)

	err = s.Erase(context.Background(), key)
	require.NoError(t, err)

	keys, err = s.AllKeys(context.Background())
	require.NoError(t, err)
	require.Equal(t, []string(nil), keys)
}
