// +build darwin

package libkb

// OSVersionAndBuild returns OS version, and build too on some platforms
func OSVersionAndBuild() (string, string, error) {
	productVersion, err := execToString("/usr/bin/sw_vers", []string{"-productVersion"})
	if err != nil {
		return "", "", err
	}

	buildVersion, err := execToString("/usr/bin/sw_vers", []string{"-buildVersion"})
	if err != nil {
		return productVersion, "", err
	}
	return productVersion, buildVersion, nil
}
