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

// NewSecretStore(user *User) and HasSecretStore() are defined in
// platform-specific files.

// TODO: NewSecretStore should probably return an error.
