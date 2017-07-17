// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// IsSocialAssertion returns true for strings that are valid
// social assertions.  They do not need to be normalized, so
// user@twitter and twitter:user will work, as will
// USER@Twitter.
func IsSocialAssertion(ctx AssertionContext, s string) bool {
	_, ok := NormalizeSocialAssertion(ctx, s)
	return ok
}

// NormalizeSocialAssertion creates a SocialAssertion from its
// input and normalizes it.  The service name will be lowercased.
// If the service is case-insensitive, then the username will also
// be lowercased.  Colon assertions (twitter:user) will be
// transformed to the user@twitter format.  Only registered
// services are allowed.
func NormalizeSocialAssertion(ctx AssertionContext, s string) (keybase1.SocialAssertion, bool) {
	url, err := ParseAssertionURL(ctx, s, true)
	if err != nil || !url.IsRemote() {
		return keybase1.SocialAssertion{}, false
	}
	return keybase1.SocialAssertion{
		User:    url.GetValue(),
		Service: keybase1.SocialAssertionService(url.GetKey()),
	}, true
}
