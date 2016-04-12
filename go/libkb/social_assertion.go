// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
)

// IsSocialAssertion returns true for strings that are valid
// social assertions.  They do not need to be normalized, so
// user@twitter and twitter:user will work, as will
// USER@Twitter.
func IsSocialAssertion(s string) bool {
	_, ok := NormalizeSocialAssertion(s)
	return ok
}

// NormalizeSocialAssertion creates a SocialAssertion from its
// input and normalizes it.  The service name will be lowercased.
// If the service is case-insensitive, then the username will also
// be lowercased.  Colon assertions (twitter:user) will be
// transformed to the user@twitter format.  Only registered
// services are allowed.
func NormalizeSocialAssertion(s string) (keybase1.SocialAssertion, bool) {
	if strings.Count(s, ":")+strings.Count(s, "@") != 1 {
		return keybase1.SocialAssertion{}, false
	}

	var name, service string

	if strings.Contains(s, ":") {
		pieces := strings.Split(s, ":")
		service = pieces[0]
		name = pieces[1]
	} else {
		pieces := strings.Split(s, "@")
		name = pieces[0]
		service = pieces[1]
	}

	service = strings.ToLower(service)
	if !ValidSocialNetwork(service) {
		return keybase1.SocialAssertion{}, false
	}

	st := GetServiceType(service)
	name, err := st.NormalizeUsername(name)
	if err != nil {
		return keybase1.SocialAssertion{}, false
	}

	return keybase1.SocialAssertion{
		User:    name,
		Service: keybase1.SocialAssertionService(service),
	}, true
}

// SocialAssertionToString returns a string that represents a social assertion.
func SocialAssertionToString(assertion keybase1.SocialAssertion) string {
	return fmt.Sprintf("%s@%s", assertion.User, assertion.Service)
}
