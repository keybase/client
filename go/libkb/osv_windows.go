// +build windows

package libkb

// OSVersionAndBuild returns OS version, and build too on some platforms
func OSVersionAndBuild() (string, string, error) {
	productVersion, err := execToString("cmd", []string{"/c", "ver"})
	if err != nil {
		return "", "", err
	}
	return productVersion, "", nil
}
