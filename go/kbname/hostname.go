// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbname

import (
	"regexp"
	"strings"
)

// Found regex here: http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
var hostnameRE = regexp.MustCompile("^(?i:[a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$")

func IsValidHostname(s string) bool {
	parts := strings.Split(s, ".")
	// Found regex here: http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
	if len(parts) < 2 {
		return false
	}
	for _, p := range parts {
		if !hostnameRE.MatchString(p) {
			return false
		}
	}
	// TLDs must be >=2 chars
	if len(parts[len(parts)-1]) < 2 {
		return false
	}
	return true
}
