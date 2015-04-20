// +build !darwin

package libkb

func NewSecretStore(username string) SecretStore {
	return nil
}

func HasSecretStore() bool {
	return false
}

func GetUsersWithStoredSecrets() ([]string, error) {
	return nil, nil
}
