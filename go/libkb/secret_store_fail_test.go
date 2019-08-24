package libkb

import "errors"

// Secret store for testing where all operations (besides Get/SetOptions) fail.

type SecretStoreFail struct{}

var _ SecretStoreAll = (*SecretStoreFail)(nil)

var ErrSecretStoreFail = errors.New("SecretStoreFail Test Error")

func NewSecretStoreFail() *SecretStoreFail {
	return &SecretStoreFail{}
}

func (s *SecretStoreFail) RetrieveSecret(m MetaContext, username NormalizedUsername) (LKSecFullSecret, error) {
	return LKSecFullSecret{}, ErrSecretStoreFail
}

func (s *SecretStoreFail) StoreSecret(m MetaContext, username NormalizedUsername, secret LKSecFullSecret) error {
	return ErrSecretStoreFail
}

func (s *SecretStoreFail) ClearSecret(m MetaContext, username NormalizedUsername) error {
	return ErrSecretStoreFail
}

func (s *SecretStoreFail) GetUsersWithStoredSecrets(m MetaContext) ([]string, error) {
	return []string{}, ErrSecretStoreFail
}

func (s *SecretStoreFail) GetOptions(MetaContext) *SecretStoreOptions  { return nil }
func (s *SecretStoreFail) SetOptions(MetaContext, *SecretStoreOptions) {}
