// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is all stuff copied from libkbfs.

package utils

import (
	"fmt"
	"sort"
	"strings"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	// ReaderSep is the string that separates readers from writers in a
	// TLF name.
	ReaderSep = "#"

	// TlfHandleExtensionSep is the string that separates the folder
	// participants from an extension suffix in the TLF name.
	TlfHandleExtensionSep = " "

	// PublicUIDName is the name given to keybase1.PublicUID.  This string
	// should correspond to an illegal or reserved Keybase user name.
	PublicUIDName = "_public"
)

func splitAndNormalizeTLFName(name string, public bool) (
	writerNames, readerNames []string,
	extensionSuffix string, err error) {

	names := strings.SplitN(name, TlfHandleExtensionSep, 2)
	if len(names) > 2 {
		return nil, nil, "", BadTLFNameError{name}
	}
	if len(names) > 1 {
		extensionSuffix = names[1]
	}

	splitNames := strings.SplitN(names[0], ReaderSep, 3)
	if len(splitNames) > 2 {
		return nil, nil, "", BadTLFNameError{name}
	}
	writerNames = strings.Split(splitNames[0], ",")
	if len(splitNames) > 1 {
		readerNames = strings.Split(splitNames[1], ",")
	}

	hasPublic := len(readerNames) == 0

	if public && !hasPublic {
		// No public folder exists for this folder.
		return nil, nil, "", NoSuchNameError{Name: name}
	}

	normalizedName, err := normalizeNamesInTLF(
		writerNames, readerNames, extensionSuffix)
	if err != nil {
		return nil, nil, "", err
	}
	if normalizedName != name {
		return nil, nil, "", TlfNameNotCanonical{name, normalizedName}
	}

	return writerNames, readerNames, strings.ToLower(extensionSuffix), nil
}

// normalizeNamesInTLF takes a split TLF name and, without doing any
// resolutions or identify calls, normalizes all elements of the
// name. It then returns the normalized name.
func normalizeNamesInTLF(writerNames, readerNames []string,
	extensionSuffix string) (string, error) {
	sortedWriterNames := make([]string, len(writerNames))
	var err error
	for i, w := range writerNames {
		sortedWriterNames[i], err = normalizeAssertionOrName(w)
		if err != nil {
			return "", err
		}
	}
	sort.Strings(sortedWriterNames)
	normalizedName := strings.Join(sortedWriterNames, ",")
	if len(readerNames) > 0 {
		sortedReaderNames := make([]string, len(readerNames))
		for i, r := range readerNames {
			sortedReaderNames[i], err = normalizeAssertionOrName(r)
			if err != nil {
				return "", err
			}
		}
		sort.Strings(sortedReaderNames)
		normalizedName += ReaderSep + strings.Join(sortedReaderNames, ",")
	}
	if len(extensionSuffix) != 0 {
		// This *should* be normalized already but make sure.  I can see not
		// doing so might surprise a caller.
		normalizedName += TlfHandleExtensionSep + strings.ToLower(extensionSuffix)
	}

	return normalizedName, nil
}

// TODO: this function can likely be replaced with a call to
// AssertionParseAndOnly when CORE-2967 and CORE-2968 are fixed.
func normalizeAssertionOrName(s string) (string, error) {
	if libkb.CheckUsername.F(s) {
		return libkb.NewNormalizedUsername(s).String(), nil
	}

	// TODO: this fails for http and https right now (see CORE-2968).
	socialAssertion, isSocialAssertion := externals.NormalizeSocialAssertion(s)
	if isSocialAssertion {
		return socialAssertion.String(), nil
	}

	if expr, err := externals.AssertionParseAndOnly(s); err == nil {
		// If the expression only contains a single url, make sure
		// it's not a just considered a single keybase username.  If
		// it is, then some non-username slipped into the default
		// "keybase" case and should be considered an error.
		urls := expr.CollectUrls(nil)
		if len(urls) == 1 && urls[0].IsKeybase() {
			return "", NoSuchUserError{s}
		}

		// Normalize and return.  Ideally `AssertionParseAndOnly`
		// would normalize for us, but that doesn't work yet, so for
		// now we'll just lower-case.  This will incorrectly lower
		// case http/https/web assertions, as well as case-sensitive
		// social assertions in AND expressions.  TODO: see CORE-2967.
		return strings.ToLower(s), nil
	}

	return "", BadTLFNameError{s}
}

// NoSuchNameError indicates that the user tried to access a
// subdirectory entry that doesn't exist.
type NoSuchNameError struct {
	Name string
}

// Error implements the error interface for NoSuchNameError
func (e NoSuchNameError) Error() string {
	return fmt.Sprintf("%s doesn't exist", e.Name)
}

// BadTLFNameError indicates a top-level folder name that has an
// incorrect format.
type BadTLFNameError struct {
	Name string
}

// Error implements the error interface for BadTLFNameError.
func (e BadTLFNameError) Error() string {
	return fmt.Sprintf("TLF name %s is in an incorrect format", e.Name)
}

// TlfNameNotCanonical indicates that a name isn't a canonical, and
// that another (not necessarily canonical) name should be tried.
type TlfNameNotCanonical struct {
	Name, NameToTry string
}

func (e TlfNameNotCanonical) Error() string {
	return fmt.Sprintf("TLF name %s isn't canonical: try %s instead",
		e.Name, e.NameToTry)
}

// NoSuchUserError indicates that the given user couldn't be resolved.
type NoSuchUserError struct {
	Input string
}

// Error implements the error interface for NoSuchUserError
func (e NoSuchUserError) Error() string {
	return fmt.Sprintf("%s is not a Keybase user", e.Input)
}

// ToStatus implements the keybase1.ToStatusAble interface for NoSuchUserError
func (e NoSuchUserError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Name: "NotFound",
		Code: int(keybase1.StatusCode_SCNotFound),
		Desc: e.Error(),
	}
}
