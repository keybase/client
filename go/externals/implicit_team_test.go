// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

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
	tc := libkb.SetupTest(t, "ParseImplicitTeamTLFName", 1)
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
		_, err := libkb.ParseImplicitTeamTLFName(MakeAssertionContext(tc.G), badName)
		require.Error(t, err)
	}
	goodName := "/keybase/public/dave,twitter:alice,bob@facebook,carol@keybase,echo"
	name, err := libkb.ParseImplicitTeamTLFName(MakeAssertionContext(tc.G), goodName)
	require.NoError(t, err)
	require.Equal(t, name.IsPublic, true)
	require.Equal(t, len(name.Writers.KeybaseUsers), 3)
	require.Equal(t, len(name.Writers.UnresolvedUsers), 2)
	require.True(t, containsString(name.Writers.KeybaseUsers, "dave"))
	require.True(t, containsString(name.Writers.KeybaseUsers, "carol"))
	require.True(t, containsString(name.Writers.KeybaseUsers, "echo"))

	firstSocial := name.Writers.UnresolvedUsers[0]
	secondSocial := name.Writers.UnresolvedUsers[1]
	aliceExpected := keybase1.SocialAssertion{User: "alice", Service: keybase1.SocialAssertionService("twitter")}
	bobExpected := keybase1.SocialAssertion{User: "bob", Service: keybase1.SocialAssertionService("facebook")}
	require.True(t, firstSocial != secondSocial)
	require.True(t, firstSocial == aliceExpected || firstSocial == bobExpected)
	require.True(t, secondSocial == aliceExpected || secondSocial == bobExpected)

	goodName = "/keybase/public/dave,bob@facebook#alice (conflicted copy 2017-03-04)"
	name, err = libkb.ParseImplicitTeamTLFName(MakeAssertionContext(tc.G), goodName)
	require.NoError(t, err)
	require.Equal(t, name.IsPublic, true)
	require.Equal(t, len(name.Writers.KeybaseUsers), 1)
	require.Equal(t, len(name.Writers.UnresolvedUsers), 1)
	require.True(t, containsString(name.Writers.KeybaseUsers, "dave"))
	require.Equal(t, name.ConflictInfo.Generation, keybase1.ConflictGeneration(1), "right conflict info")

	goodName = "/keybase/public/dave,bob@facebook#alice (conflicted copy 2017-03-04 #2)"
	name, err = libkb.ParseImplicitTeamTLFName(MakeAssertionContext(tc.G), goodName)
	require.NoError(t, err)
	require.Equal(t, name.IsPublic, true)
	require.Equal(t, len(name.Writers.KeybaseUsers), 1)
	require.Equal(t, len(name.Writers.UnresolvedUsers), 1)
	require.True(t, containsString(name.Writers.KeybaseUsers, "dave"))
	require.Equal(t, name.ConflictInfo.Generation, keybase1.ConflictGeneration(2), "right conflict info")
}

func TestParseImplicitTeamTLFNameEvenMore(t *testing.T) {
	tc := libkb.SetupTest(t, "ParseImplicitTeamTLFNameEvenMore", 1)
	tests := []struct {
		input  string
		output *keybase1.ImplicitTeamDisplayName
	}{
		{
			"/keybase/private/bob,alice#bob,alice",
			&keybase1.ImplicitTeamDisplayName{
				IsPublic: false,
				Writers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"alice", "bob"},
				},
			},
		},
		{
			"/keybase/private/bob,alice#bob,alice,doug,charlie",
			&keybase1.ImplicitTeamDisplayName{
				IsPublic: false,
				Writers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"alice", "bob"},
				},
				Readers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"charlie", "doug"},
				},
			},
		},
		{
			"/keybase/private/bob,alice,jason@github#bob,alice,doug,charlie,github:jason,keith@twitter,twitter:keith,beth@reddit,keith@github",
			&keybase1.ImplicitTeamDisplayName{
				IsPublic: false,
				Writers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"alice", "bob"},
					UnresolvedUsers: []keybase1.SocialAssertion{
						keybase1.SocialAssertion{
							User:    "jason",
							Service: keybase1.SocialAssertionService("github"),
						},
					},
				},
				Readers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"charlie", "doug"},
					UnresolvedUsers: []keybase1.SocialAssertion{
						keybase1.SocialAssertion{
							User:    "beth",
							Service: keybase1.SocialAssertionService("reddit"),
						},
						keybase1.SocialAssertion{
							User:    "keith",
							Service: keybase1.SocialAssertionService("github"),
						},
						keybase1.SocialAssertion{
							User:    "keith",
							Service: keybase1.SocialAssertionService("twitter"),
						},
					},
				},
			},
		},
		{
			"/keybase/private/keybase:alice,bob@keybase#bob,alice",
			&keybase1.ImplicitTeamDisplayName{
				IsPublic: false,
				Writers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"alice", "bob"},
				},
			},
		},
		{"/keybase/private/alice#alice#alice", nil},
		{"/keybase/private/#alice", nil},
	}

	deepEq := func(a, b keybase1.ImplicitTeamDisplayName) bool {
		x, _ := libkb.MsgpackEncode(a)
		y, _ := libkb.MsgpackEncode(b)
		fmt.Printf("%s\n", hex.EncodeToString(x))
		fmt.Printf("%s\n", hex.EncodeToString(y))
		return bytes.Equal(x, y)
	}

	for _, test := range tests {
		itn, err := libkb.ParseImplicitTeamTLFName(MakeAssertionContext(tc.G), test.input)
		if test.output == nil {
			require.Error(t, err)
		} else {
			require.True(t, deepEq(itn, *test.output))
		}
	}
}

// TestParseImplicitTeamDisplayName is just a quick sanity check.
// quick sanity test -- mostly redundant with TLFName test above
func TestParseImplicitTeamDisplayName(t *testing.T) {
	tc := libkb.SetupTest(t, "ParseImplicitTeamDisplayName", 1)
	goodName := "twitter:alice,bob@facebook,carol@keybase,dave"
	_, err := libkb.ParseImplicitTeamDisplayName(MakeAssertionContext(tc.G), "", false)
	require.Error(t, err)
	namePrivate, err := libkb.ParseImplicitTeamDisplayName(MakeAssertionContext(tc.G), goodName, false)
	require.NoError(t, err)
	namePublic, err := libkb.ParseImplicitTeamDisplayName(MakeAssertionContext(tc.G), goodName, true)
	require.NoError(t, err)
	require.False(t, namePrivate.IsPublic)
	require.True(t, namePublic.IsPublic)
}
