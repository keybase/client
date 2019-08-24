// +build dragonfly freebsd linux netbsd openbsd solaris

package libkb

// OSVersionAndBuild returns OS version, and build too on some platforms
func OSVersionAndBuild() (string, string, error) {
	productVersion, err := execToString("uname", []string{"-mrs"})
	if err != nil {
		return "", "", err
	}

	buildVersion, err := execToString("lsb_release", []string{"-sd"})
	if err != nil {
		return productVersion, "", err
	}
	return productVersion, buildVersion, nil
}
