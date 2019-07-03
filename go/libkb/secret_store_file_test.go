// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
)

func newNilMetaContext() MetaContext {
	return NewMetaContextTODO(nil)
}

func testSSDir(t *testing.T) (string, func()) {
	td, err := ioutil.TempDir("", "ss")
	require.NoError(t, err)

	create := func(name, secret string) {
		err := ioutil.WriteFile(filepath.Join(td, name+".ss"), []byte(secret), PermFile)
		require.NoError(t, err)
	}

	// create some ss files
	create("alice", "alicealicealicealicealicealiceal")
	create("bob", "bobbobbobbobbobbobbobbobbobbobbo")

	cleanup := func() {
		if err := os.RemoveAll(td); err != nil {
			t.Log(err)
		}
	}

	return td, cleanup
}

func TestSecretStoreFileRetrieveSecret(t *testing.T) {
	tc := SetupTest(t, "SecretStoreFile", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	td, tdClean := testSSDir(t)
	defer tdClean()

	cases := map[string]struct {
		username NormalizedUsername
		secret   []byte
		err      error
	}{
		"alice":     {"alice", []byte("alicealicealicealicealicealiceal"), nil},
		"bob":       {"bob", []byte("bobbobbobbobbobbobbobbobbobbobbo"), nil},
		"not found": {"nobody", nil, NewErrSecretForUserNotFound("nobody")},
	}

	ss := NewSecretStoreFile(td)

	for _, test := range cases {
		secret, err := ss.RetrieveSecret(m, test.username)
		require.Equal(t, test.err, err)
		require.True(t, bytes.Equal(secret.Bytes(), test.secret))
	}
}

func TestSecretStoreFileStoreSecret(t *testing.T) {
	tc := SetupTest(t, "SecretStoreFile", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	td, tdClean := testSSDir(t)
	defer tdClean()

	cases := map[string]struct {
		username NormalizedUsername
		secret   []byte
	}{
		"new entry": {"charlie", []byte("charliecharliecharliecharliechar")},
		"replace":   {"alice", []byte("alice_next_secret_alice_next_sec")},
	}

	ss := NewSecretStoreFile(td)

	for _, test := range cases {
		fs, err := newLKSecFullSecretFromBytes(test.secret)
		require.NoError(t, err)
		err = ss.StoreSecret(m, test.username, fs)
		require.NoError(t, err)

		secret, err := ss.RetrieveSecret(m, test.username)
		require.NoError(t, err)
		require.True(t, bytes.Equal(secret.Bytes(), test.secret))
	}
}

func TestSecretStoreFileClearSecret(t *testing.T) {
	tc := SetupTest(t, "SecretStoreFile", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	td, tdClean := testSSDir(t)
	defer tdClean()

	ss := NewSecretStoreFile(td)

	err := ss.ClearSecret(m, "alice")
	require.NoError(t, err)

	secret, err := ss.RetrieveSecret(m, "alice")
	require.IsType(t, SecretStoreError{}, err)
	require.True(t, secret.IsNil())
}

func TestSecretStoreFileGetUsersWithStoredSecrets(t *testing.T) {
	tc := SetupTest(t, "SecretStoreFile", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	td, tdClean := testSSDir(t)
	defer tdClean()

	ss := NewSecretStoreFile(td)

	users, err := ss.GetUsersWithStoredSecrets(m)
	require.NoError(t, err)
	require.Len(t, users, 2)
	sort.Strings(users)
	require.Equal(t, users[0], "alice")
	require.Equal(t, users[1], "bob")

	fs, err := newLKSecFullSecretFromBytes([]byte("xavierxavierxavierxavierxavierxa"))
	require.NoError(t, err)

	err = ss.StoreSecret(m, "xavier", fs)
	require.NoError(t, err)

	users, err = ss.GetUsersWithStoredSecrets(m)
	require.NoError(t, err)
	require.Len(t, users, 3)

	sort.Strings(users)
	require.Equal(t, users[0], "alice")
	require.Equal(t, users[1], "bob")
	require.Equal(t, users[2], "xavier")

	err = ss.ClearSecret(m, "bob")
	require.NoError(t, err)

	users, err = ss.GetUsersWithStoredSecrets(m)
	require.NoError(t, err)
	require.Len(t, users, 2)

	sort.Strings(users)
	require.Equal(t, users[0], "alice")
	require.Equal(t, users[1], "xavier")
}

func assertExists(t *testing.T, path string) {
	exists, err := FileExists(path)
	require.NoError(t, err)
	require.True(t, exists)
}

func assertNotExists(t *testing.T, path string) {
	exists, err := FileExists(path)
	require.NoError(t, err)
	require.False(t, exists)
}

func TestSecretStoreFileRetrieveUpgrade(t *testing.T) {
	tc := SetupTest(t, "SecretStoreFile", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	td, tdClean := testSSDir(t)
	defer tdClean()

	assertExists(t, filepath.Join(td, "alice.ss"))
	assertNotExists(t, filepath.Join(td, "alice.ss2"))
	assertNotExists(t, filepath.Join(td, "alice.ns2"))
	assertExists(t, filepath.Join(td, "bob.ss"))
	assertNotExists(t, filepath.Join(td, "bob.ss2"))
	assertNotExists(t, filepath.Join(td, "bob.ns2"))

	ss := NewSecretStoreFile(td)

	// retrieve secret for alice should upgrade from alice.ss to alice.ss2
	secret, err := ss.RetrieveSecret(m, "alice")
	require.NoError(t, err)

	assertNotExists(t, filepath.Join(td, "alice.ss"))
	assertExists(t, filepath.Join(td, "alice.ss2"))
	assertExists(t, filepath.Join(td, "alice.ns2"))

	secretUpgraded, err := ss.RetrieveSecret(m, "alice")
	require.NoError(t, err)
	require.True(t, bytes.Equal(secret.Bytes(), secretUpgraded.Bytes()))

	// bob v1 should be untouched
	assertExists(t, filepath.Join(td, "bob.ss"))
	assertNotExists(t, filepath.Join(td, "bob.ss2"))
	assertNotExists(t, filepath.Join(td, "bob.ns2"))
}

func TestSecretStoreFileNoise(t *testing.T) {
	tc := SetupTest(t, "SecretStoreFile", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	td, tdClean := testSSDir(t)
	defer tdClean()

	secret, err := RandBytes(32)
	require.NoError(t, err)

	lksec, err := newLKSecFullSecretFromBytes(secret)
	require.NoError(t, err)

	ss := NewSecretStoreFile(td)
	ss.StoreSecret(m, "ogden", lksec)
	noise, err := ioutil.ReadFile(filepath.Join(td, "ogden.ns2"))
	require.NoError(t, err)

	// flip one bit
	noise[0] ^= 0x01

	err = ioutil.WriteFile(filepath.Join(td, "ogden.ns2"), noise, PermFile)
	require.NoError(t, err)

	corrupt, err := ss.RetrieveSecret(m, "ogden")
	require.NoError(t, err)

	require.False(t, bytes.Equal(lksec.Bytes(), corrupt.Bytes()))
}

func TestPrimeSecretStoreFile(t *testing.T) {
	td, tdClean := testSSDir(t)
	defer tdClean()

	tc := SetupTest(t, "secret_store_file", 1)
	defer tc.Cleanup()
	tc.G.Env.Test.SecretStorePrimingDisabled = false

	mctx := NewMetaContextForTest(tc)
	secretStore := NewSecretStoreFile(td)
	err := PrimeSecretStore(mctx, secretStore)
	require.NoError(t, err)
}

func TestPrimeSecretStoreFileFail(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("this test uses chmod, skipping on Windows")
	}

	tc := SetupTest(t, "secret_store_file", 1)
	defer tc.Cleanup()
	tc.G.Env.Test.SecretStorePrimingDisabled = false

	td, cleanup := CreateReadOnlySecretStoreDir(tc)
	defer cleanup()

	mctx := NewMetaContextForTest(tc)
	secretStore := NewSecretStoreFile(td)
	err := PrimeSecretStore(mctx, secretStore)
	require.Error(t, err)
	require.Contains(t, err.Error(), "permission denied")
}
