// +build darwin,ios

// TODO

package libkb

func NewSecretStore(username NormalizedUsername) SecretStore {
	return nil
}

func HasSecretStore() bool {
	return false
}

func GetUsersWithStoredSecrets() ([]string, error) {
	return nil, nil
}

func GetTerminalPrompt() string {
	// TODO: Come up with specific prompts for other platforms.
	return "Store your key in the local secret store?"
}
