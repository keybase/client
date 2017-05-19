// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

type testNormalizedUsernameGetter map[keybase1.UID]libkb.NormalizedUsername

func (g testNormalizedUsernameGetter) GetNormalizedUsername(
	ctx context.Context, uid keybase1.UserOrTeamID) (
	libkb.NormalizedUsername, error) {
	asUser, err := uid.AsUser()
	if err != nil {
		return libkb.NormalizedUsername(""), err
	}
	name, ok := g[asUser]
	if !ok {
		return libkb.NormalizedUsername(""),
			NoSuchUserError{fmt.Sprintf("uid:%s", asUser)}
	}
	return name, nil
}

type testIdentifier struct {
	assertions             map[string]UserInfo
	assertionsBrokenTracks map[string]UserInfo
	identifiedUidsLock     sync.Mutex
	identifiedUids         map[keybase1.UID]bool
}

func (ti *testIdentifier) Identify(
	ctx context.Context, assertion, reason string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	ei := getExtendedIdentify(ctx)
	userInfo, ok := ti.assertionsBrokenTracks[assertion]
	if ok {
		if !ei.behavior.WarningInsteadOfErrorOnBrokenTracks() {
			return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""),
				libkb.UnmetAssertionError{
					User:   "imtotalllymakingthisup",
					Remote: true,
				}
		}
		ei.userBreak(userInfo.Name, userInfo.UID, &keybase1.IdentifyTrackBreaks{})
		return userInfo.Name, userInfo.UID.AsUserOrTeam(), nil
	}

	userInfo, ok = ti.assertions[assertion]
	if !ok {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			NoSuchUserError{assertion}
	}

	func() {
		ti.identifiedUidsLock.Lock()
		defer ti.identifiedUidsLock.Unlock()
		if ti.identifiedUids == nil {
			ti.identifiedUids = make(map[keybase1.UID]bool)
		}
		ti.identifiedUids[userInfo.UID] = true
	}()

	ei.userBreak(userInfo.Name, userInfo.UID, nil)
	return userInfo.Name, userInfo.UID.AsUserOrTeam(), nil
}

func makeNugAndTIForTest() (testNormalizedUsernameGetter, *testIdentifier) {
	return testNormalizedUsernameGetter{
			keybase1.MakeTestUID(1): "alice",
			keybase1.MakeTestUID(2): "bob",
			keybase1.MakeTestUID(3): "charlie",
		}, &testIdentifier{
			assertions: map[string]UserInfo{
				"alice": {
					Name: "alice",
					UID:  keybase1.MakeTestUID(1),
				},
				"bob": {
					Name: "bob",
					UID:  keybase1.MakeTestUID(2),
				},
				"charlie": {
					Name: "charlie",
					UID:  keybase1.MakeTestUID(3),
				},
			},
		}
}

func (g testNormalizedUsernameGetter) uidMap() map[keybase1.UID]libkb.NormalizedUsername {
	return (map[keybase1.UID]libkb.NormalizedUsername)(g)
}

func TestIdentify(t *testing.T) {
	nug, ti := makeNugAndTIForTest()

	uids := make(map[keybase1.UID]bool, len(nug))
	for u := range nug {
		uids[u] = true
	}

	err := identifyUsersForTLF(context.Background(), nug, ti, nug.uidMap(), false)
	require.NoError(t, err)
	require.Equal(t, uids, ti.identifiedUids)
}

func TestIdentifyAlternativeBehaviors(t *testing.T) {
	nug, ti := makeNugAndTIForTest()
	nug[keybase1.MakeTestUID(1001)] = "zebra"
	ti.assertionsBrokenTracks = map[string]UserInfo{
		"zebra": {
			Name: "zebra",
			UID:  keybase1.MakeTestUID(1001),
		},
	}

	ctx, err := makeExtendedIdentify(context.Background(),
		keybase1.TLFIdentifyBehavior_CHAT_CLI)
	require.NoError(t, err)
	err = identifyUsersForTLF(ctx, nug, ti, nug.uidMap(), false)
	require.Error(t, err)

	ctx, err = makeExtendedIdentify(context.Background(),
		keybase1.TLFIdentifyBehavior_CHAT_GUI)
	require.NoError(t, err)
	err = identifyUsersForTLF(ctx, nug, ti, nug.uidMap(), false)
	require.NoError(t, err)
	tb := getExtendedIdentify(ctx).getTlfBreakAndClose()
	require.Len(t, tb.Breaks, 1)
	require.Equal(t, "zebra", tb.Breaks[0].User.Username)
	require.NotNil(t, tb.Breaks[0].Breaks)
}
