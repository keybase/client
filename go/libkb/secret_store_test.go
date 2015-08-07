package libkb

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"testing"
)

// Used by tests that want to mock out the secret store.
type TestSecretStore struct {
	Secret []byte
}

func (tss *TestSecretStore) RetrieveSecret() ([]byte, error) {
	G.Log.Debug("| TestSecretStore::RetrieveSecret(%d)", len(tss.Secret))

	if len(tss.Secret) == 0 {
		return nil, errors.New("No secret to retrieve")
	}

	return tss.Secret, nil
}

func (tss *TestSecretStore) StoreSecret(secret []byte) error {
	G.Log.Debug("| TestSecretStore::StoreSecret(%d)", len(secret))

	tss.Secret = secret
	return nil
}

func (tss *TestSecretStore) ClearSecret() error {
	G.Log.Debug("| TestSecretStore::ClearSecret()")

	tss.Secret = nil
	return nil
}

func generateTestPrefix(t *testing.T) string {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	return fmt.Sprintf("test_%s_", hex.EncodeToString(buf))
}

func TestSecretStoreOps(t *testing.T) {
	if !HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	prefix := generateTestPrefix(t)

	username := prefix + "username"
	nu := NewNormalizedUsername(username)
	expectedSecret1 := []byte("test secret 1")
	expectedSecret2 := []byte("test secret 2")

	secretStore := NewSecretStore(nu)

	var err error

	if err = secretStore.ClearSecret(); err != nil {
		t.Error(err)
	}

	// TODO: Use platform-independent errors so they can be
	// checked for.
	var secret []byte
	if secret, err = secretStore.RetrieveSecret(); err == nil {
		t.Error("RetrieveSecret unexpectedly returned a nil error")
	}

	if secret != nil {
		t.Errorf("Retrieved secret unexpectedly: %s", string(secret))
	}

	if err = secretStore.StoreSecret(expectedSecret1); err != nil {
		t.Error(err)
	}

	if secret, err = secretStore.RetrieveSecret(); err != nil {
		t.Error(err)
	}

	if string(secret) != string(expectedSecret1) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret), string(expectedSecret1))
	}

	if err = secretStore.StoreSecret(expectedSecret2); err != nil {
		t.Error(err)
	}

	if secret, err = secretStore.RetrieveSecret(); err != nil {
		t.Error(err)
	}

	if string(secret) != string(expectedSecret2) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret), string(expectedSecret2))
	}

	if err = secretStore.ClearSecret(); err != nil {
		t.Error(err)
	}
}

func getUsersWithPrefixAndStoredSecrets(prefix string) ([]string, error) {
	usernames, err := GetUsersWithStoredSecrets()
	if err != nil {
		return nil, err
	}

	var testUsernames []string

	for _, username := range usernames {
		if strings.HasPrefix(username, prefix) {
			testUsernames = append(testUsernames, username)
		}
	}

	return testUsernames, nil
}

func TestGetUsersWithStoredSecrets(t *testing.T) {
	if !HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	prefix := generateTestPrefix(t)

	usernames, err := getUsersWithPrefixAndStoredSecrets(prefix)
	if err != nil {
		t.Error(err)
	}
	if len(usernames) != 0 {
		t.Errorf("Expected no usernames, got %d", len(usernames))
	}

	expectedUsernames := make([]string, 10)
	for i := 0; i < len(expectedUsernames); i++ {
		expectedUsernames[i] = fmt.Sprintf("%saccount with unicode テスト %d", prefix, i)
		secretStore := NewSecretStore(NewNormalizedUsername(expectedUsernames[i]))
		if err := secretStore.StoreSecret([]byte{}); err != nil {
			t.Error(err)
		}
	}

	usernames, err = getUsersWithPrefixAndStoredSecrets(prefix)
	if err != nil {
		t.Error(err)
	}

	if len(usernames) != len(expectedUsernames) {
		t.Errorf("Expected %d usernames, got %d", len(expectedUsernames), len(usernames))
	}

	for i := 0; i < len(usernames); i++ {
		if usernames[i] != expectedUsernames[i] {
			t.Errorf("Expected username %s, got %s", expectedUsernames[i], usernames[i])
		}
	}

	for i := 0; i < len(expectedUsernames); i++ {
		secretStore := NewSecretStore(NewNormalizedUsername(expectedUsernames[i]))
		err = secretStore.ClearSecret()
		if err != nil {
			t.Error(err)
		}
	}

	usernames, err = getUsersWithPrefixAndStoredSecrets(prefix)
	if err != nil {
		t.Error(err)
	}
	if len(usernames) != 0 {
		t.Errorf("Expected no usernames, got %d", len(usernames))
	}
}
