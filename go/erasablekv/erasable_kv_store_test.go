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
	value := "value"

	err = s.Put(context.Background(), key, value)
	require.NoError(t, err)

	expected, err := s.Get(context.Background(), key)
	require.Error(t, err)
	require.NotEqual(t, expected, value)

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
	noise[0] ^= 0x01

	err = ioutil.WriteFile(noiseFilePath, noise, libkb.PermFile)
	require.NoError(t, err)

	corrupt, err := s.Get(context.Background(), key)
	require.Error(t, err)
	require.NotEqual(t, corrupt, value)

	err = s.Erase(context.Background(), key)
	require.NoError(t, err)

	keys, err = s.AllKeys(context.Background())
	require.NoError(t, err)
	require.Equal(t, []string(nil), keys)
}
