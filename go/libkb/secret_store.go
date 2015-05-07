package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

type SecretRetriever interface {
	RetrieveSecret() ([]byte, error)
}

type SecretStorer interface {
	StoreSecret(secret []byte) error
}

type SecretStore interface {
	SecretRetriever
	SecretStorer
	ClearSecret() error
}

// NewSecretStore(username string), HasSecretStore(), and
// GetUsersWithStoredSecrets() ([]string, error) are defined in
// platform-specific files.

func GetConfiguredAccounts() ([]keybase1.ConfiguredAccount, error) {
	usernames, err := GetUsersWithStoredSecrets()
	if err != nil {
		return nil, err
	}
	configuredAccounts := make([]keybase1.ConfiguredAccount, len(usernames))

	for i, username := range usernames {
		configuredAccounts[i] = keybase1.ConfiguredAccount{
			Username:        username,
			HasStoredSecret: true,
		}
	}

	return configuredAccounts, nil
}

func ClearStoredSecret(username string) error {
	secretStore := NewSecretStore(username)
	if secretStore == nil {
		return nil
	}
	return secretStore.ClearSecret()
}
