// +build !darwin

package libkb

func (pi *pinentryInstance) useSecretStore(useSecretStore bool) error {
	return nil
}

func (pi *pinentryInstance) shouldStoreSecret() bool {
	return false
}
