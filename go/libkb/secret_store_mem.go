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
		return LKSecFullSecret{}, NewErrSecretForUserNotFound(username)
	}
	return secret, nil
}

func (s *SecretStoreMem) StoreSecret(m MetaContext, username NormalizedUsername, secret LKSecFullSecret) error {
	s.secrets[username] = secret
	return nil
}

func (s *SecretStoreMem) ClearSecret(m MetaContext, username NormalizedUsername) error {
	if username.IsNil() {
		m.Debug("NOOPing SecretStoreMem#ClearSecret for empty username")
		return nil
	}
	delete(s.secrets, username)
	return nil
}

func (s *SecretStoreMem) GetUsersWithStoredSecrets(m MetaContext) ([]string, error) {
	var usernames []string
	for k := range s.secrets {
		uname := k.String()
		if !isPPSSecretStore(uname) {
			usernames = append(usernames, uname)
		}
	}
	return usernames, nil
}

func (s *SecretStoreMem) GetOptions(MetaContext) *SecretStoreOptions  { return nil }
func (s *SecretStoreMem) SetOptions(MetaContext, *SecretStoreOptions) {}
