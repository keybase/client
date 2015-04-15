package libkb

import (
	"errors"
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

func TestSecretStoreOps(t *testing.T) {
	if !HasSecretStore() {
		t.Skip("Skipping test since there is no secret store")
	}

	username := "test username"
	expectedSecret1 := []byte("test secret 1")
	expectedSecret2 := []byte("test secret 2")

	secretStore := NewSecretStore(NewUserThin(username, UID{}))

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
