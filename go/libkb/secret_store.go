package libkb

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
