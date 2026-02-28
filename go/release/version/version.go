// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package version

import (
	"fmt"
	"regexp"
	"time"
)

// Parse parses version, time and commit info from string
func Parse(name string) (version string, versionShort string, t time.Time, commit string, err error) {
	versionRegex := regexp.MustCompile(`(\d+\.\d+\.\d+)[-.](\d+)[+.]([[:alnum:]]+)`)
	parts := versionRegex.FindAllStringSubmatch(name, -1)
	if len(parts) == 0 || len(parts[0]) < 4 {
		err = fmt.Errorf("Unable to parse: %s", name)
		return
	}
	versionShort = parts[0][1]
	date := parts[0][2]
	commit = parts[0][3]
	version = fmt.Sprintf("%s-%s+%s", versionShort, date, commit)
	t, _ = time.Parse("20060102150405", date)
	return
}
