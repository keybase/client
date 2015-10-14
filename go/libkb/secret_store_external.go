// +build android

package libkb

type SecretStoreAccountName struct {
	accountName string
}

func (s SecretStoreAccountName) StoreSecret(secret []byte) (err error) {
	return GetGlobalExternalKeyStore().StoreSecret(s.accountName, secret)
}

func (s SecretStoreAccountName) RetrieveSecret() ([]byte, error) {
	return GetGlobalExternalKeyStore().RetrieveSecret(s.accountName)
}

func (s SecretStoreAccountName) ClearSecret() (err error) {
	return GetGlobalExternalKeyStore().ClearSecret(s.accountName)
}

func NewSecretStore(username NormalizedUsername) SecretStore {
	GetGlobalExternalKeyStore().SetupKeyStore(string(username))
	return SecretStoreAccountName{string(username)}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets() ([]string, error) {
	usersMsgPack, err := GetGlobalExternalKeyStore().GetUsersWithStoredSecretsMsgPack()
	if err != nil {
		return nil, err
	}
	var users []string
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, users)
	return users, err
}

func GetTerminalPrompt() string {
	return GetGlobalExternalKeyStore().GetTerminalPrompt()
}
