package libkb

type SecretStoreMem struct {
	secrets map[NormalizedUsername]LKSecFullSecret
}

var _ SecretStoreAll = (*SecretStoreMem)(nil)

func NewSecretStoreMem() *SecretStoreMem {
	return &SecretStoreMem{
		secrets: make(map[NormalizedUsername]LKSecFullSecret),
	}
}

func (s *SecretStoreMem) RetrieveSecret(m MetaContext, username NormalizedUsername) (LKSecFullSecret, error) {
	secret, ok := s.secrets[username]
	if !ok {
		return LKSecFullSecret{}, ErrSecretForUserNotFound
	}
	return secret, nil
}

func (s *SecretStoreMem) StoreSecret(m MetaContext, username NormalizedUsername, secret LKSecFullSecret) error {
	s.secrets[username] = secret
	return nil
}

func (s *SecretStoreMem) ClearSecret(m MetaContext, username NormalizedUsername) error {
	delete(s.secrets, username)
	return nil
}

func (s *SecretStoreMem) GetUsersWithStoredSecrets(m MetaContext) ([]string, error) {
	var usernames []string
	for k := range s.secrets {
		usernames = append(usernames, k.String())
	}
	return usernames, nil
}
