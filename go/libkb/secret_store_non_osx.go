// +build !darwin

package libkb

func NewSecretStore(user *User) SecretStore {
	return nil
}

func HasSecretStore() bool {
	return false
}
