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

// NewSecretStore(username string), HasSecretStore(),
// GetUsersWithStoredSecrets() ([]string, error), and
// GetTerminalPrompt() are defined in platform-specific files.

func GetConfiguredAccounts(g *GlobalContext) ([]keybase1.ConfiguredAccount, error) {
	currentUsername, otherUsernames, err := g.Env.GetConfig().GetAllUsernames()
	if err != nil {
		return nil, err
	}

	allUsernames := append(otherUsernames, currentUsername)

	accounts := make(map[string]keybase1.ConfiguredAccount)

	for _, username := range allUsernames {
		accounts[username] = keybase1.ConfiguredAccount{
			Username: username,
		}
	}

	storedSecretUsernames, err := GetUsersWithStoredSecrets()
	if err != nil {
		return nil, err
	}

	for _, username := range storedSecretUsernames {
		account, ok := accounts[username]
		if ok {
			account.HasStoredSecret = true
			accounts[username] = account
		}
	}

	configuredAccounts := make([]keybase1.ConfiguredAccount, 0, len(accounts))
	for _, account := range accounts {
		configuredAccounts = append(configuredAccounts, account)
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
