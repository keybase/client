// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

func testSSDir(t *testing.T) (string, func()) {
	td, err := ioutil.TempDir("", "ss")
	if err != nil {
		t.Fatal(err)
	}

	create := func(name, secret string) {
		if err := ioutil.WriteFile(filepath.Join(td, name+".ss"), []byte(secret), 0600); err != nil {
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

	for name, test := range cases {
		secret, err := ss.RetrieveSecret(test.username)
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

	for name, test := range cases {
		fs, err := newLKSecFullSecretFromBytes(test.secret)
		if err != nil {
			t.Fatalf("failed to make new full secret: %s", err)
		}
		if err := ss.StoreSecret(test.username, fs); err != nil {
			t.Fatalf("%s: %s", name, err)
		}
		secret, err := ss.RetrieveSecret(test.username)
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

	if err := ss.ClearSecret("alice"); err != nil {
		t.Fatal(err)
	}

	secret, err := ss.RetrieveSecret("alice")
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

	users, err := ss.GetUsersWithStoredSecrets()
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

	if err := ss.StoreSecret("xavier", fs); err != nil {
		t.Fatal(err)
	}

	users, err = ss.GetUsersWithStoredSecrets()
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

	if err := ss.ClearSecret("bob"); err != nil {
		t.Fatal(err)
	}

	users, err = ss.GetUsersWithStoredSecrets()
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
