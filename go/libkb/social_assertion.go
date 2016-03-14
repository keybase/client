// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "strings"

type SocialAssertion string

func IsSocialAssertion(s string) bool {
	_, ok := NormalizeSocialAssertion(s)
	return ok
}

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
