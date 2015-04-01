package libkb

import (
	"errors"
)

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
