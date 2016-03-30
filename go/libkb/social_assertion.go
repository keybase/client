// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "strings"

// SocialAssertion is a type for individual user's on a social
// network.  It should be created via NormalizeSocialAssertion.
type SocialAssertion string

func (s SocialAssertion) Username() string {
	pieces := strings.Split(s, "@")
	return pieces[0]
}

func (s SocialAssertion) Service() string {
	pieces := strings.Split(s, "@")
	return pieces[1]
}

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
func NormalizeSocialAssertion(s string) (SocialAssertion, bool) {
	if strings.Count(s, ":")+strings.Count(s, "@") != 1 {
		return "", false
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
		return "", false
	}

	st := GetServiceType(service)
	if !st.CaseSensitiveUsername() {
		name = strings.ToLower(name)
	}

	return SocialAssertion(name + "@" + service), true
}
