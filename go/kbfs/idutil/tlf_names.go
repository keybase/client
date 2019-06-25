// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package idutil

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/pkg/errors"
)

// TODO: this function can likely be replaced with a call to
// AssertionParseAndOnly when CORE-2967 and CORE-2968 are fixed.
func normalizeAssertionOrName(s string, t tlf.Type) (string, error) {
	if kbname.CheckUsername(s) {
		return kbname.NewNormalizedUsername(s).String(), nil
	}

	// TODO: this fails for http and https right now (see CORE-2968).
	socialAssertion, isSocialAssertion := externals.NormalizeSocialAssertionStatic(context.TODO(), s)
	if isSocialAssertion {
		if t == tlf.SingleTeam {
			return "", fmt.Errorf(
				"No social assertions allowed for team TLF: %s", s)
		}
		return socialAssertion.String(), nil
	}

	sAssertion := s
	if t == tlf.SingleTeam {
		sAssertion = "team:" + s
	}
	if expr, err := externals.AssertionParseAndOnlyStatic(context.TODO(), sAssertion); err == nil {
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

	return "", BadTLFNameError{Name: s}
}

// normalizeNames normalizes a slice of names and returns
// whether any of them changed.
func normalizeNames(names []string, t tlf.Type) (changesMade bool, err error) {
	for i, name := range names {
		x, err := normalizeAssertionOrName(name, t)
		if err != nil {
			return false, err
		}
		if x != name {
			names[i] = x
			changesMade = true
		}
	}
	return changesMade, nil
}

// NormalizeNamesInTLF takes a split TLF name and, without doing any
// resolutions or identify calls, normalizes all elements of the
// name. It then returns the normalized name and a boolean flag
// whether any names were modified.
// This modifies the slices passed as arguments.
func NormalizeNamesInTLF(writerNames, readerNames []string,
	t tlf.Type, extensionSuffix string) (normalizedName string,
	changesMade bool, err error) {
	changesMade, err = normalizeNames(writerNames, t)
	if err != nil {
		return "", false, err
	}
	sort.Strings(writerNames)
	normalizedName = strings.Join(writerNames, ",")
	if len(readerNames) > 0 {
		rchanges, err := normalizeNames(readerNames, t)
		if err != nil {
			return "", false, err
		}
		changesMade = changesMade || rchanges
		sort.Strings(readerNames)
		normalizedName += tlf.ReaderSep + strings.Join(readerNames, ",")
	}
	if len(extensionSuffix) != 0 {
		// This *should* be normalized already but make sure.  I can see not
		// doing so might surprise a caller.
		nExt := strings.ToLower(extensionSuffix)
		normalizedName += tlf.HandleExtensionSep + nExt
		changesMade = changesMade || nExt != extensionSuffix
	}

	return normalizedName, changesMade, nil
}

// SplitAndNormalizeTLFName takes a tlf name as a string
// and tries to normalize it offline. In addition to other
// checks it returns TlfNameNotCanonical if it does not
// look canonical.
// Note that ordering differences do not result in TlfNameNotCanonical
// being returned.
func SplitAndNormalizeTLFName(name string, t tlf.Type) (
	writerNames, readerNames []string,
	extensionSuffix string, err error) {
	writerNames, readerNames, extensionSuffix, err = tlf.SplitName(name)
	if err != nil {
		return nil, nil, "", err
	}
	if t == tlf.SingleTeam && len(writerNames) != 1 {
		// No team folder can have more than one writer.
		return nil, nil, "", NoSuchNameError{Name: name}
	}

	hasReaders := len(readerNames) != 0
	if t != tlf.Private && hasReaders {
		// No public/team folder can have readers.
		return nil, nil, "", NoSuchNameError{Name: name}
	}

	normalizedName, changes, err := NormalizeNamesInTLF(
		writerNames, readerNames, t, extensionSuffix)
	if err != nil {
		return nil, nil, "", err
	}
	// Check for changes - not just ordering differences here.
	if changes {
		return nil, nil, "", errors.WithStack(TlfNameNotCanonical{name, normalizedName})
	}

	return writerNames, readerNames, strings.ToLower(extensionSuffix), nil
}
