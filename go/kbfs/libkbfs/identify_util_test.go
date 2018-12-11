// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type testNormalizedUsernameGetter map[keybase1.UserOrTeamID]kbname.NormalizedUsername

func (g testNormalizedUsernameGetter) GetNormalizedUsername(
	ctx context.Context, id keybase1.UserOrTeamID) (
	kbname.NormalizedUsername, error) {
	name, ok := g[id]
	if !ok {
		return kbname.NormalizedUsername(""),
			NoSuchUserError{fmt.Sprintf("uid:%s", id)}
	}
	return name, nil
}

type testIdentifier struct {
	assertions             map[string]UserInfo
	assertionsBrokenTracks map[string]UserInfo
	implicitTeams          map[string]ImplicitTeamInfo
	identifiedIDsLock      sync.Mutex
	identifiedIDs          map[keybase1.UserOrTeamID]bool
}

func (ti *testIdentifier) Identify(
	ctx context.Context, assertion, reason string) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	ei := getExtendedIdentify(ctx)
	userInfo, ok := ti.assertionsBrokenTracks[assertion]
	if ok {
		if !ei.behavior.WarningInsteadOfErrorOnBrokenTracks() {
			return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
				libkb.UnmetAssertionError{
					User:   "imtotalllymakingthisup",
					Remote: true,
				}
		}
		ei.userBreak(
			ctx, userInfo.Name, userInfo.UID, &keybase1.IdentifyTrackBreaks{})
		return userInfo.Name, userInfo.UID.AsUserOrTeam(), nil
	}

	userInfo, ok = ti.assertions[assertion]
	if !ok {
		return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			NoSuchUserError{assertion}
	}

	func() {
		ti.identifiedIDsLock.Lock()
		defer ti.identifiedIDsLock.Unlock()
		if ti.identifiedIDs == nil {
			ti.identifiedIDs = make(map[keybase1.UserOrTeamID]bool)
		}
		ti.identifiedIDs[userInfo.UID.AsUserOrTeam()] = true
	}()

	ei.userBreak(ctx, userInfo.Name, userInfo.UID, nil)
	return userInfo.Name, userInfo.UID.AsUserOrTeam(), nil
}

func (ti *testIdentifier) NormalizeSocialAssertion(
	ctx context.Context, assertion string) (keybase1.SocialAssertion, error) {
	socialAssertion, isSocialAssertion := externals.NormalizeSocialAssertionStatic(assertion)
	if !isSocialAssertion {
		return keybase1.SocialAssertion{}, fmt.Errorf("Invalid social assertion")
	}
	return socialAssertion, nil
}

func (ti *testIdentifier) IdentifyImplicitTeam(
	_ context.Context, assertions, suffix string, ty tlf.Type, _ string) (
	ImplicitTeamInfo, error) {
	// TODO: canonicalize name.
	name := assertions
	if suffix != "" {
		name += " " + suffix
	}

	iteamInfo, ok := ti.implicitTeams[ty.String()+":"+name]
	if !ok {
		return ImplicitTeamInfo{}, NoSuchTeamError{name}
	}

	func() {
		ti.identifiedIDsLock.Lock()
		defer ti.identifiedIDsLock.Unlock()
		if ti.identifiedIDs == nil {
			ti.identifiedIDs = make(map[keybase1.UserOrTeamID]bool)
		}
		ti.identifiedIDs[iteamInfo.TID.AsUserOrTeam()] = true
	}()

	return iteamInfo, nil
}

func makeNugAndTIForTest() (testNormalizedUsernameGetter, *testIdentifier) {
	return testNormalizedUsernameGetter{
			keybase1.MakeTestUID(1).AsUserOrTeam(): "alice",
			keybase1.MakeTestUID(2).AsUserOrTeam(): "bob",
			keybase1.MakeTestUID(3).AsUserOrTeam(): "charlie",
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

func (g testNormalizedUsernameGetter) uidMap() map[keybase1.UserOrTeamID]kbname.NormalizedUsername {
	return (map[keybase1.UserOrTeamID]kbname.NormalizedUsername)(g)
}

func TestIdentify(t *testing.T) {
	nug, ti := makeNugAndTIForTest()

	ids := make(map[keybase1.UserOrTeamID]bool, len(nug))
	for u := range nug {
		ids[u] = true
	}

	err := identifyUsersForTLF(
		context.Background(), nug, ti, nug.uidMap(), tlf.Private)
	require.NoError(t, err)
	require.Equal(t, ids, ti.identifiedIDs)
}

func TestIdentifyAlternativeBehaviors(t *testing.T) {
	nug, ti := makeNugAndTIForTest()
	nug[keybase1.MakeTestUID(1001).AsUserOrTeam()] = "zebra"
	ti.assertionsBrokenTracks = map[string]UserInfo{
		"zebra": {
			Name: "zebra",
			UID:  keybase1.MakeTestUID(1001),
		},
	}

	ctx, err := MakeExtendedIdentify(context.Background(),
		keybase1.TLFIdentifyBehavior_CHAT_CLI)
	require.NoError(t, err)
	err = identifyUsersForTLF(ctx, nug, ti, nug.uidMap(), tlf.Private)
	require.Error(t, err)

	ctx, err = MakeExtendedIdentify(context.Background(),
		keybase1.TLFIdentifyBehavior_CHAT_GUI)
	require.NoError(t, err)
	err = identifyUsersForTLF(ctx, nug, ti, nug.uidMap(), tlf.Private)
	require.NoError(t, err)
	tb := getExtendedIdentify(ctx).getTlfBreakAndClose()
	require.Len(t, tb.Breaks, 1)
	require.Equal(t, "zebra", tb.Breaks[0].User.Username)
	require.NotNil(t, tb.Breaks[0].Breaks)
}

func TestIdentifyImplicitTeams(t *testing.T) {
	nug, ti := makeNugAndTIForTest()

	// Add implicit teams.
	pubID := keybase1.MakeTestTeamID(1, true)
	privID := keybase1.MakeTestTeamID(1, false)
	suffixID := keybase1.MakeTestTeamID(2, false)
	ti.implicitTeams = map[string]ImplicitTeamInfo{
		"public:alice,bob": ImplicitTeamInfo{
			Name: "alice,bob",
			TID:  pubID,
		},
		"private:alice,bob": ImplicitTeamInfo{
			Name: "alice,bob",
			TID:  privID,
		},
		"private:alice,bob (conflicted copy 2016-03-14 #3)": ImplicitTeamInfo{
			Name: "alice,bob (conflicted copy 2016-03-14 #3)",
			TID:  suffixID,
		},
	}

	ids := make(map[keybase1.UserOrTeamID]bool, len(ti.implicitTeams))
	for _, iteamInfo := range ti.implicitTeams {
		ids[iteamInfo.TID.AsUserOrTeam()] = true
	}

	err := identifyUsersForTLF(
		context.Background(), nug, ti,
		map[keybase1.UserOrTeamID]kbname.NormalizedUsername{
			privID.AsUserOrTeam(): "alice,bob",
		}, tlf.Private)
	require.NoError(t, err)
	err = identifyUsersForTLF(
		context.Background(), nug, ti,
		map[keybase1.UserOrTeamID]kbname.NormalizedUsername{
			pubID.AsUserOrTeam(): "alice,bob",
		}, tlf.Public)
	require.NoError(t, err)
	err = identifyUsersForTLF(
		context.Background(), nug, ti,
		map[keybase1.UserOrTeamID]kbname.NormalizedUsername{
			suffixID.AsUserOrTeam(): "alice,bob (conflicted copy 2016-03-14 #3)",
		}, tlf.Private)
	require.NoError(t, err)
	require.Equal(t, ids, ti.identifiedIDs)
}
