// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
)

const (
	// ReaderSep is the string that separates readers from writers in a
	// TLF name.
	ReaderSep = "#"
)

// SplitName splits a TLF name into components.
func SplitName(name string) (writerNames, readerNames []string,
	extensionSuffix string, err error) {
	names := strings.SplitN(name, HandleExtensionSep, 2)
	if len(names) > 2 {
		return nil, nil, "", BadNameError{name}
	}
	if len(names) > 1 {
		extensionSuffix = names[1]
	}

	splitNames := strings.SplitN(names[0], ReaderSep, 3)
	if len(splitNames) > 2 {
		return nil, nil, "", BadNameError{name}
	}
	writerNames = strings.Split(splitNames[0], ",")
	if len(splitNames) > 1 {
		readerNames = strings.Split(splitNames[1], ",")
	}

	return writerNames, readerNames, extensionSuffix, nil
}

// CanonicalName is a string containing the canonical name of a TLF.
type CanonicalName string

// PreferredName is a preferred TLF name.
type PreferredName string

// FavoriteNameToPreferredTLFNameFormatAs formats a favorite names for display with the
// username given.
// An empty username is allowed here and results in tlfname being returned unmodified.
func FavoriteNameToPreferredTLFNameFormatAs(username libkb.NormalizedUsername,
	canon CanonicalName) (PreferredName, error) {
	tlfname := string(canon)
	if len(username) == 0 {
		return PreferredName(tlfname), nil
	}
	ws, rs, ext, err := SplitName(tlfname)
	if err != nil {
		return "", err
	}
	if len(ws) == 0 {
		return "", fmt.Errorf("TLF name %q with no writers", tlfname)
	}
	uname := username.String()
	for i, w := range ws {
		if w == uname {
			if i != 0 {
				copy(ws[1:i+1], ws[0:i])
				ws[0] = w
				tlfname = strings.Join(ws, ",")
				if len(rs) > 0 {
					tlfname += ReaderSep + strings.Join(rs, ",")
				}
				if len(ext) > 0 {
					tlfname += HandleExtensionSep + ext
				}
			}
			break
		}
	}
	return PreferredName(tlfname), nil
}
