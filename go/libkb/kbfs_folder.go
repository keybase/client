// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"fmt"
	"sort"
	"strings"
)

var caseSensitiveServices = map[string]bool{"hackernews": true}

// CanonicalizeName takes a folder name as input and returns a
// canonical version of it. It also checks for basic errors.
func CanonicalizeName(name string) (string, error) {
	// check for invalid characters
	if strings.ContainsAny(name, "/+") {
		return "", errors.New("invalid character in name")
	}

	// split into individual ids
	ids := strings.Split(name, ",")
	for i, id := range ids {
		// check for multiple separators
		if strings.Count(id, ":")+strings.Count(id, "@") > 1 {
			return "", fmt.Errorf("invalid identity %q", id)
		}

		// convert from service:name to name@service
		if strings.Contains(id, ":") {
			pieces := strings.Split(id, ":")
			id = pieces[1] + "@" + pieces[0]
		}

		// some services have case-sensitive usernames
		pieces := strings.Split(id, "@")
		if len(pieces) == 2 && caseSensitiveServices[pieces[1]] {
			ids[i] = id
		} else {
			ids[i] = strings.ToLower(id)
		}
	}
	sort.Strings(ids)

	return strings.Join(ids, ","), nil
}
