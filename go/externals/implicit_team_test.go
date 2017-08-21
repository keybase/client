// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"bytes"
	"encoding/hex"
	"fmt"
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
}

func TestPartImplicitTeamTLFNameEvenMore(t *testing.T) {
	tests := []struct {
		input  string
		output *keybase1.ImplicitTeamName
	}{
		{
			"/keybase/private/bob,alice#bob,alice",
			&keybase1.ImplicitTeamName{
				IsPrivate: true,
				Writers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"alice", "bob"},
				},
			},
		},
		{
			"/keybase/private/bob,alice#bob,alice,doug,charlie",
			&keybase1.ImplicitTeamName{
				IsPrivate: true,
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
			&keybase1.ImplicitTeamName{
				IsPrivate: true,
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
			&keybase1.ImplicitTeamName{
				IsPrivate: true,
				Writers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"alice", "bob"},
				},
			},
		},
		{"/keybase/private/alice#alice#alice", nil},
		{"/keybase/private/#alice", nil},
	}

	deepEq := func(a, b keybase1.ImplicitTeamName) bool {
		x, _ := libkb.MsgpackEncode(a)
		y, _ := libkb.MsgpackEncode(b)
		fmt.Printf("%s\n", hex.EncodeToString(x))
		fmt.Printf("%s\n", hex.EncodeToString(y))
		return bytes.Equal(x, y)
	}

	for _, test := range tests {
		itn, err := libkb.ParseImplicitTeamTLFName(MakeAssertionContext(), test.input)
		if test.output == nil {
			require.Error(t, err)
		} else {
			require.True(t, deepEq(itn, *test.output))
		}
	}
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
