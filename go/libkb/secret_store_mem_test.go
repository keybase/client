package libkb

import (
	"bytes"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
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
	m := newNilMetaContext()
	for _, test := range cases {
		fs, err := newLKSecFullSecretFromBytes(test.secret)
		require.NoError(t, err)

		err = s.StoreSecret(m, test.username, fs)
		require.NoError(t, err)

		secret, err := s.RetrieveSecret(m, test.username)
		require.NoError(t, err)
		require.True(t, bytes.Equal(secret.Bytes(), test.secret))
	}

	_, err := s.RetrieveSecret(m, "nobody")
	require.IsType(t, SecretStoreError{}, err)

	users, err := s.GetUsersWithStoredSecrets(m)
	require.NoError(t, err)
	require.Len(t, users, 2)
	sort.Strings(users)
	require.Equal(t, users[0], "alice")
	require.Equal(t, users[1], "charlie")

	err = s.ClearSecret(m, "alice")
	require.NoError(t, err)

	secret, err := s.RetrieveSecret(m, "alice")
	require.IsType(t, SecretStoreError{}, err)
	require.True(t, secret.IsNil())
}
