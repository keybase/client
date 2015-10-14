// +build android

package libkb

// Represents interface to some external key store
var GlobalExternalKeyStore ExternalKeyStore

// This is called by Android to register Android's KeyStore with Go
func SetGlobalExternalKeyStore(s ExternalKeyStore) { GlobalExternalKeyStore = s }

type SecretStoreAccountName struct {
	accountName string
}

func (s SecretStoreAccountName) StoreSecret(secret []byte) (err error) {
	return GlobalExternalKeyStore.StoreSecret(s.accountName, secret)
}

func (s SecretStoreAccountName) RetrieveSecret() ([]byte, error) {
	return GlobalExternalKeyStore.RetrieveSecret(s.accountName)
}

func (s SecretStoreAccountName) ClearSecret() (err error) {
	return GlobalExternalKeyStore.ClearSecret(s.accountName)
}

func NewSecretStore(username NormalizedUsername) SecretStore {
	GlobalExternalKeyStore.SetupKeyStore(string(username))
	return SecretStoreAccountName{string(username)}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets() ([]string, error) {
	usersMsgPack, err := GlobalExternalKeyStore.GetUsersWithStoredSecretsMsgPack()
	if err != nil {
		return nil, err
	}
	var users []string
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, users)
	return users, err
}

func GetTerminalPrompt() string {
	return GlobalExternalKeyStore.GetTerminalPrompt()
}
