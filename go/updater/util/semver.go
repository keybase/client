package util

import "github.com/blang/semver/v4"

// Semver outputs the semver in Major.Minor.Patch form for readability.
func Semver(version string) string {
	v, err := semver.Parse(version)
	if err != nil {
		return version
	}
	v.Pre = nil
	v.Build = nil
	return v.String()
}
