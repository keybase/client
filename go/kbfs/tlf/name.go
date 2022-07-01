// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"fmt"
	"sort"
	"strings"

	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	// ReaderSep is the string that separates readers from writers in a
	// TLF name.
	ReaderSep = "#"
)

// SplitExtension separates any extension suffix from the assertions.
func SplitExtension(name string) (
	assertions, extensionSuffix string, err error) {
	names := strings.SplitN(name, HandleExtensionSep, 2)
	if len(names) > 2 {
		return "", "", BadNameError{name}
	}
	if len(names) > 1 {
		extensionSuffix = names[1]
	}
	return names[0], extensionSuffix, nil
}

// SplitName splits a TLF name into components.
func SplitName(name string) (writerNames, readerNames []string,
	extensionSuffix string, err error) {
	assertions, extensionSuffix, err := SplitExtension(name)
	if err != nil {
		return nil, nil, "", err
	}

	splitNames := strings.SplitN(assertions, ReaderSep, 3)
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

func getSortedNames(
	resolved []kbname.NormalizedUsername,
	unresolved []keybase1.SocialAssertion) []string {
	var names []string
	for _, name := range resolved {
		names = append(names, name.String())
	}
	for _, sa := range unresolved {
		names = append(names, sa.String())
	}
	sort.Strings(names)
	return names
}

func makeCanonicalName(resolvedWriters []kbname.NormalizedUsername,
	unresolvedWriters []keybase1.SocialAssertion,
	resolvedReaders []kbname.NormalizedUsername,
	unresolvedReaders []keybase1.SocialAssertion,
	extensions []HandleExtension, isBackedByTeam bool) CanonicalName {
	writerNames := getSortedNames(resolvedWriters, unresolvedWriters)
	canonicalName := strings.Join(writerNames, ",")
	if len(resolvedReaders)+len(unresolvedReaders) > 0 {
		readerNames := getSortedNames(resolvedReaders, unresolvedReaders)
		canonicalName += ReaderSep + strings.Join(readerNames, ",")
	}

	extensionList := make(HandleExtensionList, len(extensions))
	copy(extensionList, extensions)
	sort.Sort(extensionList)
	if isBackedByTeam {
		canonicalName += extensionList.SuffixForTeamHandle()
	} else {
		canonicalName += extensionList.Suffix()
	}
	return CanonicalName(canonicalName)
}

// MakeCanonicalName makes a CanonicalName from components.
func MakeCanonicalName(resolvedWriters []kbname.NormalizedUsername,
	unresolvedWriters []keybase1.SocialAssertion,
	resolvedReaders []kbname.NormalizedUsername,
	unresolvedReaders []keybase1.SocialAssertion,
	extensions []HandleExtension) CanonicalName {
	return makeCanonicalName(
		resolvedWriters, unresolvedWriters, resolvedReaders, unresolvedReaders,
		extensions, false)
}

// MakeCanonicalNameForTeam makes a CanonicalName from components for a team.
func MakeCanonicalNameForTeam(resolvedWriters []kbname.NormalizedUsername,
	unresolvedWriters []keybase1.SocialAssertion,
	resolvedReaders []kbname.NormalizedUsername,
	unresolvedReaders []keybase1.SocialAssertion,
	extensions []HandleExtension) CanonicalName {
	return makeCanonicalName(
		resolvedWriters, unresolvedWriters, resolvedReaders, unresolvedReaders,
		extensions, true)
}

// PreferredName is a preferred TLF name.
type PreferredName string

func putUserFirst(uname string, users []string) []string {
	for i, w := range users {
		if w == uname {
			if i != 0 {
				copy(users[1:i+1], users[0:i])
				users[0] = w
				return users
			}
		}
	}
	return users
}

// CanonicalToPreferredName returns the preferred TLF name, given a
// canonical name and a username. The username may be empty, and
// results in the canonical name being being returned unmodified.
func CanonicalToPreferredName(username kbname.NormalizedUsername,
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
	ws = putUserFirst(uname, ws)
	rs = putUserFirst(uname, rs)
	tlfname = strings.Join(ws, ",")
	if len(rs) > 0 {
		tlfname += ReaderSep + strings.Join(rs, ",")
	}
	if len(ext) > 0 {
		tlfname += HandleExtensionSep + ext
	}
	return PreferredName(tlfname), nil
}

// UserIsOnlyWriter returns true if and only if username is the only writer in
// a TLF represented by canon. In any error case, false is returned. This
// function only naively looks at the TLF name, so it should only be used on
// non-team TLFs.
func UserIsOnlyWriter(username kbname.NormalizedUsername, canon CanonicalName) bool {
	tlfname := string(canon)
	if len(username) == 0 {
		return false
	}
	ws, _, _, err := SplitName(tlfname)
	if err != nil {
		return false
	}
	return len(ws) == 1 && ws[0] == string(username)
}
