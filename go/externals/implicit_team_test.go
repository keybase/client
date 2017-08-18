// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"github.com/stretchr/testify/require"
	"testing"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func containsString(xs []string, target string) bool {
	for _, x := range xs {
		if x == target {
			return true
		}
	}
	return false
}

func TestParseImplicitTeamTLFName(t *testing.T) {
	badNames := []string{
		"foobar",
		"/keybas/public/foo,bar",
		"/keybase/publi/foo,bar",
		"/keybase/public/foobar,foo:@bar",
		"/keybase/public/foobar,foobar::",
		"/keybase/public/foobar,alice@fakemedia",
		"/keybase/public/foobar__underscore",
	}
	for _, badName := range badNames {
		_, err := libkb.ParseImplicitTeamTLFName(MakeAssertionContext(), badName)
		require.Error(t, err)
	}
	goodName := "/keybase/public/dave,twitter:alice,bob@facebook,carol@keybase,echo"
	name, err := libkb.ParseImplicitTeamTLFName(MakeAssertionContext(), goodName)
	require.NoError(t, err)
	require.Equal(t, name.IsPrivate, false)
	require.Equal(t, len(name.KeybaseUsers), 3)
	require.Equal(t, len(name.UnresolvedUsers), 2)
	require.True(t, containsString(name.KeybaseUsers, "dave"))
	require.True(t, containsString(name.KeybaseUsers, "carol"))
	require.True(t, containsString(name.KeybaseUsers, "echo"))

	firstSocial := name.UnresolvedUsers[0]
	secondSocial := name.UnresolvedUsers[1]
	aliceExpected := keybase1.SocialAssertion{User: "alice", Service: keybase1.SocialAssertionService("twitter")}
	bobExpected := keybase1.SocialAssertion{User: "bob", Service: keybase1.SocialAssertionService("facebook")}
	require.True(t, firstSocial != secondSocial)
	require.True(t, firstSocial == aliceExpected || firstSocial == bobExpected)
	require.True(t, secondSocial == aliceExpected || secondSocial == bobExpected)
}

// TestParseImplicitTeamName is just a quick sanity check.
// quick sanity test -- mostly redundant with TLFName test above
func TestParseImplicitTeamName(t *testing.T) {
	goodName := "twitter:alice,bob@facebook,carol@keybase,dave"
	namePrivate, err := libkb.ParseImplicitTeamName(MakeAssertionContext(), goodName, true)
	require.NoError(t, err)
	namePublic, err := libkb.ParseImplicitTeamName(MakeAssertionContext(), goodName, false)
	require.NoError(t, err)
	require.True(t, namePrivate.IsPrivate)
	require.True(t, !namePublic.IsPrivate)
}
