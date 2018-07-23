// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func newNilMetaContext() MetaContext {
	return NewMetaContextTODO(nil)
}

func testSSDir(t *testing.T) (string, func()) {
	td, err := ioutil.TempDir("", "ss")
	if err != nil {
		t.Fatal(err)
	}

	create := func(name, secret string) {
		if err := ioutil.WriteFile(filepath.Join(td, name+".ss"), []byte(secret), PermFile); err != nil {
			t.Fatal(err)
		}
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
	td, tdClean := testSSDir(t)
	defer tdClean()

	cases := map[string]struct {
		username NormalizedUsername
		secret   []byte
		err      error
	}{
		"alice":     {"alice", []byte("alicealicealicealicealicealiceal"), nil},
		"bob":       {"bob", []byte("bobbobbobbobbobbobbobbobbobbobbo"), nil},
		"not found": {"nobody", nil, ErrSecretForUserNotFound},
	}

	ss := NewSecretStoreFile(td)
	m := newNilMetaContext()

	for name, test := range cases {
		secret, err := ss.RetrieveSecret(m, test.username)
		if err != test.err {
			t.Fatalf("%s: err: %v, expected %v", name, err, test.err)
		}
		if !bytes.Equal(secret.Bytes(), test.secret) {
			t.Errorf("%s: secret: %x, expected %x", name, secret.Bytes(), test.secret)
		}
	}
}

func TestSecretStoreFileStoreSecret(t *testing.T) {
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
	m := newNilMetaContext()

	for name, test := range cases {
		fs, err := newLKSecFullSecretFromBytes(test.secret)
		if err != nil {
			t.Fatalf("failed to make new full secret: %s", err)
		}
		if err := ss.StoreSecret(m, test.username, fs); err != nil {
			t.Fatalf("%s: %s", name, err)
		}
		secret, err := ss.RetrieveSecret(m, test.username)
		if err != nil {
			t.Fatalf("%s: %s", name, err)
		}
		if !bytes.Equal(secret.Bytes(), test.secret) {
			t.Errorf("%s: secret: %x, expected %x", name, secret, test.secret)
		}
	}
}

func TestSecretStoreFileClearSecret(t *testing.T) {
	td, tdClean := testSSDir(t)
	defer tdClean()

	ss := NewSecretStoreFile(td)
	m := newNilMetaContext()

	if err := ss.ClearSecret(m, "alice"); err != nil {
		t.Fatal(err)
	}

	secret, err := ss.RetrieveSecret(m, "alice")
	if err != ErrSecretForUserNotFound {
		t.Fatalf("err: %v, expected %v", err, ErrSecretForUserNotFound)
	}
	if !secret.IsNil() {
		t.Errorf("secret: %+v, expected nil", secret)
	}
}

func TestSecretStoreFileGetUsersWithStoredSecrets(t *testing.T) {
	td, tdClean := testSSDir(t)
	defer tdClean()

	ss := NewSecretStoreFile(td)
	m := newNilMetaContext()

	users, err := ss.GetUsersWithStoredSecrets(m)
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 2 {
		t.Fatalf("num users: %d, expected 2", len(users))
	}
	sort.Strings(users)
	if users[0] != "alice" {
		t.Errorf("user 0: %s, expected alice", users[0])
	}
	if users[1] != "bob" {
		t.Errorf("user 1: %s, expected bob", users[1])
	}

	fs, err := newLKSecFullSecretFromBytes([]byte("xavierxavierxavierxavierxavierxa"))
	if err != nil {
		t.Fatal(err)
	}

	if err := ss.StoreSecret(m, "xavier", fs); err != nil {
		t.Fatal(err)
	}

	users, err = ss.GetUsersWithStoredSecrets(m)
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 3 {
		t.Fatalf("num users: %d, expected 3", len(users))
	}
	sort.Strings(users)
	if users[0] != "alice" {
		t.Errorf("user 0: %s, expected alice", users[0])
	}
	if users[1] != "bob" {
		t.Errorf("user 1: %s, expected bob", users[1])
	}
	if users[2] != "xavier" {
		t.Errorf("user 2: %s, expected xavier", users[2])
	}

	if err := ss.ClearSecret(m, "bob"); err != nil {
		t.Fatal(err)
	}

	users, err = ss.GetUsersWithStoredSecrets(m)
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 2 {
		t.Fatalf("num users: %d, expected 2", len(users))
	}
	sort.Strings(users)
	if users[0] != "alice" {
		t.Errorf("user 0: %s, expected alice", users[0])
	}
	if users[1] != "xavier" {
		t.Errorf("user 1: %s, expected xavier", users[1])
	}
}

func assertExists(t *testing.T, path string) {
	exists, err := FileExists(path)
	if err != nil {
		t.Fatal(err)
	}
	if !exists {
		t.Errorf("expected %s to exist", path)
	}
}

func assertNotExists(t *testing.T, path string) {
	exists, err := FileExists(path)
	if err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Errorf("expected %s to not exist", path)
	}
}

func TestSecretStoreFileRetrieveUpgrade(t *testing.T) {
	td, tdClean := testSSDir(t)
	defer tdClean()

	assertExists(t, filepath.Join(td, "alice.ss"))
	assertNotExists(t, filepath.Join(td, "alice.ss2"))
	assertNotExists(t, filepath.Join(td, "alice.ns2"))
	assertExists(t, filepath.Join(td, "bob.ss"))
	assertNotExists(t, filepath.Join(td, "bob.ss2"))
	assertNotExists(t, filepath.Join(td, "bob.ns2"))

	ss := NewSecretStoreFile(td)
	m := newNilMetaContext()

	// retrieve secret for alice should upgrade from alice.ss to alice.ss2
	secret, err := ss.RetrieveSecret(m, "alice")
	if err != nil {
		t.Fatal(err)
	}

	assertNotExists(t, filepath.Join(td, "alice.ss"))
	assertExists(t, filepath.Join(td, "alice.ss2"))
	assertExists(t, filepath.Join(td, "alice.ns2"))

	secretUpgraded, err := ss.RetrieveSecret(m, "alice")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(secret.Bytes(), secretUpgraded.Bytes()) {
		t.Errorf("alice secret changed after upgrade")
	}

	// bob v1 should be untouched
	assertExists(t, filepath.Join(td, "bob.ss"))
	assertNotExists(t, filepath.Join(td, "bob.ss2"))
	assertNotExists(t, filepath.Join(td, "bob.ns2"))
}

func TestSecretStoreFileNoise(t *testing.T) {
	td, tdClean := testSSDir(t)
	defer tdClean()

	secret, err := RandBytes(32)
	if err != nil {
		t.Fatal(err)
	}
	lksec, err := newLKSecFullSecretFromBytes(secret)
	if err != nil {
		t.Fatal(err)
	}
	ss := NewSecretStoreFile(td)
	m := newNilMetaContext()
	ss.StoreSecret(m, "ogden", lksec)
	noise, err := ioutil.ReadFile(filepath.Join(td, "ogden.ns2"))
	if err != nil {
		t.Fatal(err)
	}

	// flip one bit
	noise[0] ^= 0x01

	if err := ioutil.WriteFile(filepath.Join(td, "ogden.ns2"), noise, PermFile); err != nil {
		t.Fatal(err)
	}

	corrupt, err := ss.RetrieveSecret(m, "ogden")
	if err != nil {
		t.Fatal(err)
	}

	if bytes.Equal(lksec.Bytes(), corrupt.Bytes()) {
		t.Fatal("corrupted noise file did not change the secret")
	}
}
