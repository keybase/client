// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/stretchr/testify/require"
)

// realTrackLinks imports the real v2 track link in linkVer2 as the server
// sends it in full and as it sends it stubbed: two links with the same ID.
// Each is verified and marked chain-verified, as a load does before it stores
// its links.
func realTrackLinks(t *testing.T, tc TestContext) (full, stub *ChainLink) {
	m := NewMetaContextForTest(tc)
	full, err := ImportLinkFromServer(m, nil, []byte(linkVer2), linkUID)
	require.NoError(t, err)
	require.False(t, full.IsStubbed())

	stubJSON := `{"s2":"` + full.unpacked.outerLinkV2.EncodeStubbed() + `"}`
	stub, err = ImportLinkFromServer(m, nil, []byte(stubJSON), linkUID)
	require.NoError(t, err)
	require.True(t, stub.IsStubbed())
	require.Equal(t, full.id, stub.id)

	for _, l := range []*ChainLink{full, stub} {
		require.NoError(t, l.VerifyLink())
		l.markChainVerified()
	}
	return full, stub
}

// realChainSegment returns the real device link in linkVer1 (seqno 5), the
// track link that follows it (seqno 6) in full and stubbed, all parented to one
// chain, and the key family that signed them.
func realChainSegment(t *testing.T, tc TestContext) (device, full, stub *ChainLink, kf *KeyFamily) {
	m := NewMetaContextForTest(tc)
	full, stub = realTrackLinks(t, tc)
	device, err := ImportLinkFromServer(m, nil, []byte(linkVer1), linkUID)
	require.NoError(t, err)
	require.NoError(t, device.VerifyLink())
	require.Equal(t, device.id, full.GetPrev())

	sc := &SigChain{Contextified: NewContextified(tc.G), uid: linkUID, username: "testuser1874"}
	for _, l := range []*ChainLink{device, full, stub} {
		l.SetParent(sc)
	}

	jw, err := jsonw.Unmarshal([]byte(`{"all_bundles":[
		"012057bd86a5c2a8e5e0ba228021b49216e38158ce04abba069fe9b3c2298d283a600a",
		"0120e5b206afdd8ad09f527e79721e21024237d31db98e6cb4038d5bcc785b68b6130a",
		"0121441e6d9bfa1ec7f2c9e245b3c23f6fd9544a9050b86a54cfb82c5cd2c4b099300a"]}`))
	require.NoError(t, err)
	kf, err = ParseKeyFamily(tc.G, jw)
	require.NoError(t, err)
	return device, full, stub, kf
}

func storedLinkRecord(t *testing.T, g *GlobalContext, id LinkID) []byte {
	raw, found, err := g.LocalDb.GetRaw(DbKey{Typ: DBLink, Key: id.String()})
	require.NoError(t, err)
	require.True(t, found)
	return raw
}

func TestTrackChainLinkFromUPK2AIStubbedLink(t *testing.T) {
	tc := SetupTest(t, "stubbed_track", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	_, stub := realTrackLinks(t, tc)
	_, err := stub.Store(m)
	require.NoError(t, err)

	followee := keybase1.UID("6c01fd886268fd6df8185cac265ca819")
	follower := &keybase1.UserPlusKeysV2AllIncarnations{
		Current: keybase1.UserPlusKeysV2{
			Uid: linkUID,
			RemoteTracks: map[keybase1.UID]keybase1.RemoteTrack{
				followee: {Username: "testuser", Uid: followee, LinkID: keybase1.LinkID(stub.id.String())},
			},
		},
	}

	// The UPAK says we track testuser, but the stored link has no payload to
	// parse; this must send identify down its forced-reload path, not crash.
	tcl, err := TrackChainLinkFromUPK2AI(m, follower, NewNormalizedUsername("testuser"), followee)
	require.Nil(t, tcl)
	var inconsistent InconsistentCacheStateError
	require.ErrorAs(t, err, &inconsistent)
}

func TestStoreKeepsFullLinkOverStub(t *testing.T) {
	tc := SetupTest(t, "stubbed_store", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	full, stub := realTrackLinks(t, tc)
	_, err := full.Store(m)
	require.NoError(t, err)
	fullRecord := storedLinkRecord(t, tc.G, full.id)

	// A load caches each link from the server before storing it.
	putLinkToCache(m, stub)
	didStore, err := stub.Store(m)
	require.NoError(t, err)
	// Reported as stored so SigChain.Store keeps walking to older links.
	require.True(t, didStore)
	require.Equal(t, string(fullRecord), string(storedLinkRecord(t, tc.G, stub.id)))
	_, cached := tc.G.LinkCache().Get(stub.id)
	require.False(t, cached, "the cached stub would hide the full link on disk")

	got, err := ImportLinkFromStorage(m, stub.id, linkUID)
	require.NoError(t, err)
	require.False(t, got.IsStubbed())
}

func TestStoreReplacesUnreadableRecordWithStub(t *testing.T) {
	tc := SetupTest(t, "stubbed_store_junk", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	_, stub := realTrackLinks(t, tc)
	require.NoError(t, tc.G.LocalDb.PutRaw(DbKey{Typ: DBLink, Key: stub.id.String()}, []byte(`{"junk":1}`)))

	_, err := stub.Store(m)
	require.NoError(t, err)
	require.Contains(t, string(storedLinkRecord(t, tc.G, stub.id)), `"s2"`)
}

func TestParseTrackChainLinkStubbedLink(t *testing.T) {
	tc := SetupTest(t, "stubbed_parse", 1)
	defer tc.Cleanup()

	// Payload readers chain jsonw lookups on UnmarshalPayloadJSON; a stub
	// must make them fail, not crash.
	full, stub := realTrackLinks(t, tc)
	_, err := ParseTrackChainLink(GenericChainLink{stub})
	require.Error(t, err)
	_, err = ParseTrackChainLink(GenericChainLink{full})
	require.NoError(t, err)
}

func TestLinkCacheKeepsFullLinkOverStub(t *testing.T) {
	tc := SetupTest(t, "stubbed_cache", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)
	c := NewLinkCache(10, time.Hour)
	defer c.Shutdown()

	full, stub := realTrackLinks(t, tc)

	c.Put(m, full.id, *full)
	c.Put(m, stub.id, *stub)
	got, ok := c.Get(stub.id)
	require.True(t, ok)
	require.False(t, got.IsStubbed())

	// The other direction is how a forced unstubbed reload heals the cache.
	c.Remove(stub.id)
	c.Put(m, stub.id, *stub)
	c.Put(m, full.id, *full)
	got, ok = c.Get(stub.id)
	require.True(t, ok)
	require.False(t, got.IsStubbed())
}

// Key state computed over stubs is stored with the link and survives a reload
// from disk; records written before the flag existed read as not stub-derived.
func TestSkippedStubsKeyStateRoundTrip(t *testing.T) {
	tc := SetupTest(t, "stubbed_cki_roundtrip", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	full, _ := realTrackLinks(t, tc)
	cki := NewComputedKeyInfos(tc.G)
	cki.SkippedStubs = true
	full.PutSigCheckCache(cki)
	_, err := full.Store(m)
	require.NoError(t, err)
	require.Contains(t, string(storedLinkRecord(t, tc.G, full.id)), `"SkippedStubs":true`)

	tc.G.LinkCache().Remove(full.id)
	got, err := ImportLinkFromStorage(m, full.id, linkUID)
	require.NoError(t, err)
	require.NotNil(t, got.GetSigCheckCache())
	require.True(t, got.GetSigCheckCache().SkippedStubs)
	require.True(t, got.GetSigCheckCache().ShallowCopy().SkippedStubs)

	old := NewChainLink(tc.G, nil, nil)
	require.NoError(t, old.UnpackComputedKeyInfos([]byte(`{"Version":4,"Infos":{}}`)))
	require.False(t, old.cki.SkippedStubs)
}

// Key state computed over a chain with stubs is flagged, and a load whose
// chain has no stubs left recomputes rather than reusing it: the full links
// may carry state (e.g. a revocation) that the stubs hid.
func TestStubDerivedKeyStateNotReusedWithoutStubs(t *testing.T) {
	tc := SetupTest(t, "stubbed_cki_reuse", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)
	device, full, stub, kf := realChainSegment(t, tc)

	cached, cki, err := verifySubchain(m, "testuser1874", *kf, ChainLinks{device, stub})
	require.NoError(t, err)
	require.False(t, cached)
	require.True(t, cki.SkippedStubs)
	cached, _, err = verifySubchain(m, "testuser1874", *kf, ChainLinks{device, stub})
	require.NoError(t, err)
	require.True(t, cached, "a chain that still has the stubs reuses the result")

	stubbed := SigChain{Contextified: NewContextified(tc.G), chainLinks: ChainLinks{device, stub}}
	require.Equal(t, cki, stubbed.GetComputedKeyInfosWithVersionBust())

	// The same state on the full link's record, as a stubbed load whose
	// chain later lost its stubs would leave it.
	full.PutSigCheckCache(cki)
	unstubbed := SigChain{Contextified: NewContextified(tc.G), chainLinks: ChainLinks{device, full}}
	require.Nil(t, unstubbed.GetComputedKeyInfosWithVersionBust())

	// Recomputing verifies the tip's signature, which this segment can't
	// satisfy (its eldest key was delegated before seqno 5); reuse wouldn't
	// check it. So the error shows verifySubchain recomputed.
	cached, _, err = verifySubchain(m, "testuser1874", *kf, ChainLinks{device, full})
	require.False(t, cached)
	require.Error(t, err)

	cki.SkippedStubs = false
	require.Equal(t, cki, unstubbed.GetComputedKeyInfosWithVersionBust())
	cached, _, err = verifySubchain(m, "testuser1874", *kf, ChainLinks{device, full})
	require.NoError(t, err)
	require.True(t, cached)
}
