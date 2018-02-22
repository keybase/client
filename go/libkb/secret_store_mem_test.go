package libkb

import (
	"bytes"
	"sort"
	"testing"
)

func TestSecretStoreMem(t *testing.T) {
	cases := map[string]struct {
		username NormalizedUsername
		secret   []byte
	}{
		"alice":   {"alice", []byte("alice_first_sec_first_sec_first_")},
		"charlie": {"charlie", []byte("charliecharliecharliecharliechar")},
		"replace": {"alice", []byte("alice_next_secret_alice_next_sec")},
	}

	s := NewSecretStoreMem()
	for name, test := range cases {
		fs, err := newLKSecFullSecretFromBytes(test.secret)
		if err != nil {
			t.Fatalf("failed to make new full secret: %s", err)
		}
		if err := s.StoreSecret(test.username, fs); err != nil {
			t.Fatalf("%s: %s", name, err)
		}
		secret, err := s.RetrieveSecret(test.username)
		if err != nil {
			t.Fatalf("%s: %s", name, err)
		}
		if !bytes.Equal(secret.Bytes(), test.secret) {
			t.Errorf("%s: secret: %x, expected %x", name, secret, test.secret)
		}
	}

	if _, err := s.RetrieveSecret("nobody"); err != ErrSecretForUserNotFound {
		t.Fatalf("retrieve err: %s (%T), expected ErrSecretForUserNotFound", err, err)
	}

	users, err := s.GetUsersWithStoredSecrets()
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
	if users[1] != "charlie" {
		t.Errorf("user 1: %s, expected charlie", users[1])
	}

	if err := s.ClearSecret("alice"); err != nil {
		t.Fatal(err)
	}
	secret, err := s.RetrieveSecret("alice")
	if err != ErrSecretForUserNotFound {
		t.Fatalf("err: %v, expected %v", err, ErrSecretForUserNotFound)
	}
	if !secret.IsNil() {
		t.Errorf("secret: %+v, expected nil", secret)
	}
}
