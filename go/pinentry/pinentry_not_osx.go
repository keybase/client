// +build !darwin

package pinentry

type pinentrySecretStoreInfo struct{}

func (pi *pinentryInstance) useSecretStore(useSecretStore bool) (pinentrySecretStoreInfo, error) {
	return pinentrySecretStoreInfo{}, nil
}

func (pi *pinentryInstance) shouldStoreSecret(info pinentrySecretStoreInfo) bool {
	return false
}
