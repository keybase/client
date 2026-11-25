// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/json"
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	testvectors "github.com/keybase/keybase-test-vectors/go"
	"github.com/stretchr/testify/require"
)

type trackingChangedListener struct {
	NoopNotifyListener
	uids []keybase1.UID
}

func (l *trackingChangedListener) TrackingChanged(uid keybase1.UID, _ NormalizedUsername) {
	l.uids = append(l.uids, uid)
}

// loadOwnChainAsNewFromServer loads a test vector chain the way a self load
// sees links it has not stored yet.
func loadOwnChainAsNewFromServer(t *testing.T, tc TestContext, input string) (*SigChain, keybase1.KID, []string) {
	var parsed TestInput
	inputJSON := testvectors.ChainTestInputs[input]
	require.NoError(t, json.Unmarshal([]byte(inputJSON), &parsed))
	blob, err := jsonw.Unmarshal([]byte(inputJSON))
	require.NoError(t, err)
	uid, err := UIDFromHex(parsed.UID)
	require.NoError(t, err)
	eldest, _, err := ParseGenericKey(parsed.Keys[0])
	require.NoError(t, err)
	keyFamily, err := createKeyFamily(tc.G, parsed.Keys)
	require.NoError(t, err)

	m := NewMetaContextForTest(tc)
	sigchain := &SigChain{
		username:          NewNormalizedUsername(parsed.Username),
		uid:               uid,
		loadedFromLinkOne: true,
		Contextified:      NewContextified(tc.G),
	}
	n, err := blob.AtKey("chain").Len()
	require.NoError(t, err)
	for i := range n {
		raw, err := blob.AtKey("chain").AtIndex(i).Marshal()
		require.NoError(t, err)
		link, err := ImportLinkFromServer(m, sigchain, raw, uid)
		require.NoError(t, err)
		sigchain.chainLinks = append(sigchain.chainLinks, link)
	}
	ckf := ComputedKeyFamily{Contextified: NewContextified(tc.G), kf: keyFamily}
	_, err = sigchain.VerifySigsAndComputeKeys(m, eldest.GetKID(), &ckf, uid)
	require.NoError(t, err)
	return sigchain, eldest.GetKID(), parsed.Keys
}

func markAllOwnNewFromServer(sigchain *SigChain) {
	for _, link := range sigchain.chainLinks {
		link.isOwnNewLinkFromServer = true
	}
}

func isTrackingLink(l TypedChainLink) bool {
	switch l.(type) {
	case *TrackChainLink, *UntrackChainLink:
		return true
	default:
		return false
	}
}

// The engine that posts a track or untrack link from this device sends its own
// trackingChanged, so the next self load must not repeat it. Links another
// device posted still get one, since that load is the only signal for them.
func TestOwnNewTrackLinksFromThisDeviceAreNotNotifiedAgain(t *testing.T) {
	tc := SetupTest(t, "id_table_notify", 1)
	defer tc.Cleanup()
	tc.G.SetService()
	m := NewMetaContextForTest(tc)

	listener := &trackingChangedListener{}
	tc.G.NotifyRouter.AddListener(listener)

	sigchain, eldest, keys := loadOwnChainAsNewFromServer(t, tc, "00dani.json")

	markAllOwnNewFromServer(sigchain)
	idt, err := NewIdentityTable(m, eldest, sigchain, nil)
	require.NoError(t, err)
	all := len(listener.uids)

	var thisDevice keybase1.KID
	fromThisDevice := 0
	for _, l := range idt.Order {
		if !isTrackingLink(l) {
			continue
		}
		if thisDevice.IsNil() {
			thisDevice = l.GetKID()
		}
		if l.GetKID().Equal(thisDevice) {
			fromThisDevice++
		}
	}
	require.Positive(t, fromThisDevice)
	require.Greater(t, all, fromThisDevice, "the chain needs tracking links from more than one key")

	var sigKey GenericKey
	for _, bundle := range keys {
		k, _, err := ParseGenericKey(bundle)
		require.NoError(t, err)
		if k.GetKID().Equal(thisDevice) {
			sigKey = k
		}
	}
	require.NotNil(t, sigKey)
	tc.G.ActiveDevice = &ActiveDevice{uv: keybase1.UserVersion{Uid: sigchain.uid}, signingKey: sigKey}

	listener.uids = nil
	markAllOwnNewFromServer(sigchain)
	_, err = NewIdentityTable(m, eldest, sigchain, nil)
	require.NoError(t, err)
	require.Len(t, listener.uids, all-fromThisDevice)
}
