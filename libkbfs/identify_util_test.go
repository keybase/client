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
	ctx context.Context, uid keybase1.UID) (
	libkb.NormalizedUsername, error) {
	name, ok := g[uid]
	if !ok {
		return libkb.NormalizedUsername(""),
			NoSuchUserError{fmt.Sprintf("uid:%s", uid)}
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
	ctx context.Context, assertion, reason string) (UserInfo, error) {
	ei := getExtendedIdentify(ctx)
	userInfo, ok := ti.assertionsBrokenTracks[assertion]
	if ok {
		if !ei.behavior.WarningInsteadOfErrorOnBrokenTracks() {
			return UserInfo{}, libkb.UnmetAssertionError{
				User:   "imtotalllymakingthisup",
				Remote: true,
			}
		}
		ei.userBreak(userInfo.Name, userInfo.UID, &keybase1.IdentifyTrackBreaks{})
		return userInfo, nil
	}

	userInfo, ok = ti.assertions[assertion]
	if !ok {
		return UserInfo{}, NoSuchUserError{assertion}
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
	return userInfo, nil
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
func TestIdentify(t *testing.T) {
	nug, ti := makeNugAndTIForTest()

	uids := make(map[keybase1.UID]bool, len(nug))
	uidList := make([]keybase1.UID, 0, len(nug))
	for u := range nug {
		uids[u] = true
		uidList = append(uidList, u)
	}

	err := identifyUserListForTLF(context.Background(), nug, ti, uidList, false)
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

	uidList := make([]keybase1.UID, 0, len(nug))
	for u := range nug {
		uidList = append(uidList, u)
	}

	ctx, err := makeExtendedIdentify(context.Background(),
		keybase1.TLFIdentifyBehavior_CHAT_CLI)
	require.NoError(t, err)
	err = identifyUserListForTLF(ctx, nug, ti, uidList, false)
	require.Error(t, err)

	ctx, err = makeExtendedIdentify(context.Background(),
		keybase1.TLFIdentifyBehavior_CHAT_GUI)
	require.NoError(t, err)
	err = identifyUserListForTLF(ctx, nug, ti, uidList, false)
	require.NoError(t, err)
	tb := getExtendedIdentify(ctx).getTlfBreakOrBust()
	require.Len(t, tb.Breaks, 1)
	require.Equal(t, "zebra", tb.Breaks[0].User.Username)
	require.NotNil(t, tb.Breaks[0].Breaks)
}
