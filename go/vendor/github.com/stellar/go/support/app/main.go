// Package app provides vars that can be populated via "-X" linker flags to
// provide global application metadata, such as build time or version.
package app

import "time"
import "github.com/stellar/go/support/errors"

var (
	// ErrNoBuildTime is the error returned when no build time for the current
	// binary was set.
	ErrNoBuildTime = errors.New("build time not known")
)

// BuildTime returns the time that the binary of the current process was built.
// Our build script populates the `buildTime` var used to provide this result.
func BuildTime() (time.Time, error) {
	if buildTime == "" {
		return time.Time{}, ErrNoBuildTime
	}

	t, err := time.Parse(time.RFC3339, buildTime)
	if err != nil {
		return time.Time{}, errors.Wrap(err, "parse failed")
	}

	return t, nil
}

// Version returns the build version of the binary executing the current
// process. Our build script populates the `version` var, if a version tag is
// set.  If not populated, a generic "devel" value will be returned.
func Version() string {
	if version == "" {
		return "devel"
	}

	return version
}

var (
	buildTime string
	version   string
)
