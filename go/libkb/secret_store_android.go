// +build android

package libkb

type AndroidSecretStore struct {
	accountName string
}

func (s AndroidSecretStore) StoreSecret(secret []byte) (err error) {
	return G.androidKeyStore.StoreSecret(s.accountName, secret)
}

func (s AndroidSecretStore) RetrieveSecret() ([]byte, error) {
	return G.androidKeyStore.RetrieveSecret(s.accountName)
}

func (s AndroidSecretStore) ClearSecret() (err error) {
	return G.androidKeyStore.ClearSecret(s.accountName)
}

func NewSecretStore(username NormalizedUsername) SecretStore {
	G.androidKeyStore.SetupKeyStore(string(username))
	return AndroidSecretStore{string(username)}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets() ([]string, error) {
	usersMsgPack, err := G.androidKeyStore.GetUsersWithStoredSecretsMsgPack()
	if (err != nil) {
		return nil, err
	}
	var users []string
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, users)
	return users, err
}

func GetTerminalPrompt() string {
	return "Store your key in Android's KeyStore?"
}
