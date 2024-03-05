package util

import "github.com/blang/semver"

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
