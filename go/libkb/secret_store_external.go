// +build android

package libkb

type SecretStoreAccountName struct {
	accountName string
}

func (s SecretStoreAccountName) StoreSecret(secret []byte) (err error) {
	return G.externalKeyStore.StoreSecret(s.accountName, secret)
}

func (s SecretStoreAccountName) RetrieveSecret() ([]byte, error) {
	return G.externalKeyStore.RetrieveSecret(s.accountName)
}

func (s SecretStoreAccountName) ClearSecret() (err error) {
	return G.externalKeyStore.ClearSecret(s.accountName)
}

func NewSecretStore(username NormalizedUsername) SecretStore {
	G.externalKeyStore.SetupKeyStore(string(username))
	return SecretStoreAccountName{string(username)}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets() ([]string, error) {
	usersMsgPack, err := G.externalKeyStore.GetUsersWithStoredSecretsMsgPack()
	if err != nil {
		return nil, err
	}
	var users []string
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, users)
	return users, err
}

func GetTerminalPrompt() string {
	return G.externalKeyStore.GetTerminalPrompt()
}
