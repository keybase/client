// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlfhandle

import (
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbfs/idutil"
	idutiltest "github.com/keybase/client/go/kbfs/idutil/test"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type testIdentifier struct {
	assertions             map[string]idutil.UserInfo
	assertionsBrokenTracks map[string]idutil.UserInfo
	implicitTeams          map[string]idutil.ImplicitTeamInfo
	identifiedIDsLock      sync.Mutex
	identifiedIDs          map[keybase1.UserOrTeamID]bool
}

func (ti *testIdentifier) Identify(
	ctx context.Context, assertion, reason string,
	_ keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	ei := GetExtendedIdentify(ctx)
	userInfo, ok := ti.assertionsBrokenTracks[assertion]
	if ok {
		if !ei.Behavior.WarningInsteadOfErrorOnBrokenTracks() {
			return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
				libkb.UnmetAssertionError{
					User:   "imtotalllymakingthisup",
					Remote: true,
				}
		}
		ei.UserBreak(
			ctx, userInfo.Name, userInfo.UID, &keybase1.IdentifyTrackBreaks{})
		return userInfo.Name, userInfo.UID.AsUserOrTeam(), nil
	}

	userInfo, ok = ti.assertions[assertion]
	if !ok {
		return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			idutil.NoSuchUserError{Input: assertion}
	}

	func() {
		ti.identifiedIDsLock.Lock()
		defer ti.identifiedIDsLock.Unlock()
		if ti.identifiedIDs == nil {
			ti.identifiedIDs = make(map[keybase1.UserOrTeamID]bool)
		}
		ti.identifiedIDs[userInfo.UID.AsUserOrTeam()] = true
	}()

	ei.UserBreak(ctx, userInfo.Name, userInfo.UID, nil)
	return userInfo.Name, userInfo.UID.AsUserOrTeam(), nil
}

func (ti *testIdentifier) NormalizeSocialAssertion(
	ctx context.Context, assertion string) (keybase1.SocialAssertion, error) {
	socialAssertion, isSocialAssertion := externals.NormalizeSocialAssertionStatic(ctx, assertion)
	if !isSocialAssertion {
		return keybase1.SocialAssertion{}, fmt.Errorf("Invalid social assertion")
	}
	return socialAssertion, nil
}

func (ti *testIdentifier) IdentifyImplicitTeam(
	_ context.Context, assertions, suffix string, ty tlf.Type, _ string,
	_ keybase1.OfflineAvailability) (idutil.ImplicitTeamInfo, error) {
	// TODO: canonicalize name.
	name := assertions
	if suffix != "" {
		name += " " + suffix
	}

	iteamInfo, ok := ti.implicitTeams[ty.String()+":"+name]
	if !ok {
		return idutil.ImplicitTeamInfo{}, idutil.NoSuchTeamError{Input: name}
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

func makeNugAndTIForTest() (
	idutiltest.NormalizedUsernameGetter, *testIdentifier) {
	return idutiltest.NormalizedUsernameGetter{
			keybase1.MakeTestUID(1).AsUserOrTeam(): "alice",
			keybase1.MakeTestUID(2).AsUserOrTeam(): "bob",
			keybase1.MakeTestUID(3).AsUserOrTeam(): "charlie",
		}, &testIdentifier{
			assertions: map[string]idutil.UserInfo{
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

	ids := make(map[keybase1.UserOrTeamID]bool, len(nug))
	for u := range nug {
		ids[u] = true
	}

	err := identifyUsersForTLF(
		context.Background(), nug, ti, nug.UIDMap(), tlf.Private,
		keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	require.Equal(t, ids, ti.identifiedIDs)
}

func TestIdentifyAlternativeBehaviors(t *testing.T) {
	nug, ti := makeNugAndTIForTest()
	nug[keybase1.MakeTestUID(1001).AsUserOrTeam()] = "zebra"
	ti.assertionsBrokenTracks = map[string]idutil.UserInfo{
		"zebra": {
			Name: "zebra",
			UID:  keybase1.MakeTestUID(1001),
		},
	}

	ctx, err := MakeExtendedIdentify(context.Background(),
		keybase1.TLFIdentifyBehavior_CHAT_CLI)
	require.NoError(t, err)
	err = identifyUsersForTLF(
		ctx, nug, ti, nug.UIDMap(), tlf.Private,
		keybase1.OfflineAvailability_NONE)
	require.Error(t, err)

	ctx, err = MakeExtendedIdentify(context.Background(),
		keybase1.TLFIdentifyBehavior_CHAT_GUI)
	require.NoError(t, err)
	err = identifyUsersForTLF(
		ctx, nug, ti, nug.UIDMap(), tlf.Private,
		keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	tb := GetExtendedIdentify(ctx).GetTlfBreakAndClose()
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
	ti.implicitTeams = map[string]idutil.ImplicitTeamInfo{
		"public:alice,bob": {
			Name: "alice,bob",
			TID:  pubID,
		},
		"private:alice,bob": {
			Name: "alice,bob",
			TID:  privID,
		},
		"private:alice,bob (conflicted copy 2016-03-14 #3)": {
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
		}, tlf.Private, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	err = identifyUsersForTLF(
		context.Background(), nug, ti,
		map[keybase1.UserOrTeamID]kbname.NormalizedUsername{
			pubID.AsUserOrTeam(): "alice,bob",
		}, tlf.Public, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	err = identifyUsersForTLF(
		context.Background(), nug, ti,
		map[keybase1.UserOrTeamID]kbname.NormalizedUsername{
			suffixID.AsUserOrTeam(): "alice,bob (conflicted copy 2016-03-14 #3)",
		}, tlf.Private, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	require.Equal(t, ids, ti.identifiedIDs)
}
