package lru

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestDiskLRUCleaner(t *testing.T) {
	tc := libkb.SetupTest(t, "TestDiskLRUCleaner", 1)
	defer tc.Cleanup()

	mctx := libkb.NewMetaContextForTest(tc)
	ctx := mctx.Ctx()
	cacheDir, err := ioutil.TempDir("", "example")
	require.NoError(t, err)
	defer os.RemoveAll(cacheDir)
	l := NewDiskLRU("mike", 1, 10)
	c := NewDiskLRUCleaner(cacheDir, l)

	file, err := ioutil.TempFile(cacheDir, "tmpfile")
	require.NoError(t, err)
	data, err := libkb.RandBytes(1024 * 1024)
	require.NoError(t, err)
	_, err = file.Write(data)
	require.NoError(t, err)
	file.Close()

	// File is not cleaned since it is in the LRU
	k := "mikem:square_360"
	v := file.Name()
	_, err = l.Put(ctx, tc.G, k, v)
	require.NoError(t, err)
	err = c.Clean(mctx)
	require.NoError(t, err)
	exists, err := libkb.FileExists(file.Name())
	require.NoError(t, err)
	require.True(t, exists)

	// File is cleaned now that the lru no longer has that key.
	err = l.Remove(ctx, tc.G, k)
	require.NoError(t, err)
	err = c.Clean(mctx)
	require.NoError(t, err)
	exists, err = libkb.FileExists(file.Name())
	require.NoError(t, err)
	require.False(t, exists)
}
