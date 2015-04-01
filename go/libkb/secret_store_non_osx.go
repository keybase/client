// +build !darwin

package libkb

func NewSecretStore(user *User) SecretStore {
	return nil
}
