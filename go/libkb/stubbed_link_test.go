// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	testvectors "github.com/keybase/keybase-test-vectors/go"
	"github.com/stretchr/testify/require"
)

// realTrackLinks imports the real v2 track link in linkVer2 as the server
// sends it in full and as it sends it stubbed: two links with the same ID.
// Both are in their signer's chain, verified and marked chain-verified, as a
// load does before it stores its links.
func realTrackLinks(t *testing.T, tc TestContext) (full, stub *ChainLink) {
	m := NewMetaContextForTest(tc)
	sc := &SigChain{Contextified: NewContextified(tc.G), uid: linkUID, username: "testuser1874"}
	full, err := ImportLinkFromServer(m, sc, []byte(linkVer2), linkUID)
	require.NoError(t, err)
	require.False(t, full.IsStubbed())
	require.NoError(t, full.CheckNameAndID(sc.username, sc.uid))

	stub = stubOf(t, tc, full, sc)
	for _, l := range []*ChainLink{full, stub} {
		require.NoError(t, l.VerifyLink())
		l.markChainVerified()
	}
	return full, stub
}

// stubOf imports full as the server sends it stubbed, as a link of chain.
func stubOf(t *testing.T, tc TestContext, full *ChainLink, chain *SigChain) *ChainLink {
	stubJSON := `{"s2":"` + full.unpacked.outerLinkV2.EncodeStubbed() + `"}`
	stub, err := ImportLinkFromServer(NewMetaContextForTest(tc), chain, []byte(stubJSON), linkUID)
	require.NoError(t, err)
	require.True(t, stub.IsStubbed())
	require.Equal(t, full.id, stub.id)
	return stub
}

// realChainSegment returns the real device link in linkVer1 (seqno 5), the
// track link that follows it (seqno 6) in full and stubbed, all parented to one
// chain, and the key family that signed them.
func realChainSegment(t *testing.T, tc TestContext) (device, full, stub *ChainLink, kf *KeyFamily) {
	m := NewMetaContextForTest(tc)
	full, stub = realTrackLinks(t, tc)
	device, err := ImportLinkFromServer(m, full.Parent(), []byte(linkVer1), linkUID)
	require.NoError(t, err)
	require.NoError(t, device.VerifyLink())
	require.Equal(t, device.id, full.GetPrev())

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
	raw, found, err := g.LocalDb.GetRaw(linkDbKey(id))
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

	// The same state on the full link's record, as a stubbed load whose
	// chain later lost its stubs would leave it.
	full.PutSigCheckCache(cki)

	// Recomputing verifies the tip's signature, which this segment can't
	// satisfy (its eldest key was delegated before seqno 5); reuse wouldn't
	// check it. So the error shows verifySubchain recomputed.
	cached, _, err = verifySubchain(m, "testuser1874", *kf, ChainLinks{device, full})
	require.False(t, cached)
	require.Error(t, err)

	cki.SkippedStubs = false
	cached, _, err = verifySubchain(m, "testuser1874", *kf, ChainLinks{device, full})
	require.NoError(t, err)
	require.True(t, cached)
}

// A read served from the LinkCache counts as a use of the stored record. If it
// didn't, the DB cleaner would evict the links of a chain that stays cached in
// memory, and the next cold load would find gaps in it.
func TestCachedLinkReadKeepsStoredRecord(t *testing.T) {
	tc := SetupTest(t, "cached_link_read", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	full, _ := realTrackLinks(t, tc)
	_, err := full.Store(m)
	require.NoError(t, err)

	// The first read comes from disk and fills the cache.
	_, err = ImportLinkFromStorage(m, full.id, linkUID)
	require.NoError(t, err)
	_, cached := tc.G.LinkCache().Get(full.id)
	require.True(t, cached)

	// A cleaner pass keeps a record used since the previous pass and forgets
	// the use, so only the cached read below protects it from the next pass.
	require.NoError(t, tc.G.LocalDb.Clean(true))

	got, err := ImportLinkFromStorage(m, full.id, linkUID)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.NoError(t, tc.G.LocalDb.Clean(true))
	storedLinkRecord(t, tc.G, full.id)

	// Without a read in between, the next pass does evict it.
	require.NoError(t, tc.G.LocalDb.Clean(true))
	require.NoError(t, tc.G.LocalDb.Clean(true))
	_, found, err := tc.G.LocalDb.GetRaw(linkDbKey(full.id))
	require.NoError(t, err)
	require.False(t, found)
}

// A stored record that has a sig but can't be unpacked fails every load that
// reaches it, so a stub must replace it like any other unusable record.
func TestStoreReplacesCorruptFullRecordWithStub(t *testing.T) {
	tc := SetupTest(t, "stubbed_store_corrupt", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	full, stub := realTrackLinks(t, tc)
	_, err := full.Store(m)
	require.NoError(t, err)
	record, err := jsonw.Unmarshal(storedLinkRecord(t, tc.G, full.id))
	require.NoError(t, err)
	sig, err := record.AtKey("sig").GetString()
	require.NoError(t, err)
	require.NotEmpty(t, sig)
	require.NoError(t, record.DeleteKey("sig_id"))
	corrupt, err := record.Marshal()
	require.NoError(t, err)
	require.NoError(t, tc.G.LocalDb.PutRaw(linkDbKey(full.id), corrupt))
	_, err = ImportLinkFromStorage(m, full.id, linkUID)
	require.Error(t, err)

	putLinkToCache(m, stub)
	_, err = stub.Store(m)
	require.NoError(t, err)
	require.Contains(t, string(storedLinkRecord(t, tc.G, stub.id)), `"s2"`)

	tc.G.LinkCache().Remove(stub.id)
	got, err := ImportLinkFromStorage(m, stub.id, linkUID)
	require.NoError(t, err)
	require.True(t, got.IsStubbed())
}

// A reader can cache the full link from disk between the load caching its
// stub and storing it. Keeping the full record leaves that entry in place.
func TestStoreKeepsCachedFullLink(t *testing.T) {
	tc := SetupTest(t, "stubbed_store_cached_full", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	full, stub := realTrackLinks(t, tc)
	_, err := full.Store(m)
	require.NoError(t, err)

	putLinkToCache(m, stub)
	putLinkToCache(m, full)
	_, err = stub.Store(m)
	require.NoError(t, err)
	got, cached := tc.G.LinkCache().Get(stub.id)
	require.True(t, cached)
	require.False(t, got.IsStubbed())
}

// A stored full link is marked chain-verified, so a chain that kept it in
// place of its stub would never check that the link names that chain's owner.
// A stub in someone else's chain must replace the record instead.
func TestStoreReplacesFullLinkOfAnotherUser(t *testing.T) {
	tc := SetupTest(t, "stubbed_store_other_user", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	full, _ := realTrackLinks(t, tc)
	_, err := full.Store(m)
	require.NoError(t, err)

	other := &SigChain{Contextified: NewContextified(tc.G), uid: keybase1.UID("6c01fd886268fd6df8185cac265ca819"), username: "testuser"}
	require.Error(t, full.CheckNameAndID(other.username, other.uid))
	stub := stubOf(t, tc, full, other)
	require.NoError(t, stub.VerifyLink())
	stub.markChainVerified()

	_, err = stub.Store(m)
	require.NoError(t, err)
	require.Contains(t, string(storedLinkRecord(t, tc.G, stub.id)), `"s2"`)
}

// resetChain is the first 10 links of the reset_2x test vector, verified: a
// subchain (seqnos 1-4, with a stub at 3), then a reset and the current
// subchain (5-10, no stubs). newLoader returns a loader for it as a load of a
// user whose chain hasn't moved on the server, so it never needs the network
// while the stored links are intact.
func resetChain(t *testing.T, tc TestContext) (chain *SigChain, newLoader func() *SigChainLoader) {
	m := NewMetaContextForTest(tc)
	inputJSON := testvectors.ChainTestInputs["reset_2x.json"]
	var input TestInput
	require.NoError(t, json.Unmarshal([]byte(inputJSON), &input))
	inputBlob, err := jsonw.Unmarshal([]byte(inputJSON))
	require.NoError(t, err)
	uid, err := UIDFromHex(input.UID)
	require.NoError(t, err)
	eldest := keybase1.KIDFromString(input.LabelKids["f"])
	kf, err := createKeyFamily(tc.G, input.Keys)
	require.NoError(t, err)

	chain = &SigChain{
		username:          NewNormalizedUsername(input.Username),
		uid:               uid,
		loadedFromLinkOne: true,
		Contextified:      NewContextified(tc.G),
	}
	for i := range 10 {
		raw, err := inputBlob.AtKey("chain").AtIndex(i).Marshal()
		require.NoError(t, err)
		link, err := ImportLinkFromServer(m, chain, raw, uid)
		require.NoError(t, err)
		chain.chainLinks = append(chain.chainLinks, link)
	}
	require.True(t, chain.chainLinks[2].IsStubbed())
	ckf := ComputedKeyFamily{Contextified: NewContextified(tc.G), kf: kf}
	_, err = chain.VerifySigsAndComputeKeys(m, eldest, &ckf, uid)
	require.NoError(t, err)
	require.Equal(t, keybase1.Seqno(5), chain.currentSubchainStart)
	require.False(t, chain.chainLinks[4:].hasStubs())

	newLoader = func() *SigChainLoader {
		return &SigChainLoader{
			user: &User{name: input.Username, id: uid, keyFamily: kf},
			leaf: &MerkleUserLeaf{
				public: chain.GetCurrentTailTriple(),
				uid:    uid,
				eldest: eldest,
			},
			chainType:        PublicChain,
			MetaContextified: NewMetaContextified(m),
		}
	}
	return chain, newLoader
}

func storeChain(t *testing.T, tc TestContext, chain *SigChain, loader *SigChainLoader) {
	loader.chain = chain
	loader.dirtyTail = chain.GetCurrentTailTriple()
	require.NoError(t, chain.Store(NewMetaContextForTest(tc)))
	require.NoError(t, loader.Store())
}

// emptyLinkCache makes the next load read every link from storage.
func emptyLinkCache(tc TestContext) {
	tc.G.cacheMu.Lock()
	tc.G.linkCache = NewLinkCache(1000, time.Hour)
	tc.G.cacheMu.Unlock()
}

// A chain whose current subchain has no stubs, but whose tip carries key state
// computed over stubs, recomputes that state on the next load and stores it,
// so the load after that is fully cached again. The stub in an older subchain
// must not make the loader treat the tip's state as reusable when
// verifySubchain won't.
func TestLoadRecomputesStubDerivedKeyStateOnce(t *testing.T) {
	tc := SetupTest(t, "stubbed_cki_load", 1)
	defer tc.Cleanup()

	chain, newLoader := resetChain(t, tc)
	tip := chain.GetLastLink()
	flagged := tip.GetSigCheckCache().ShallowCopy()
	flagged.SkippedStubs = true
	tip.PutSigCheckCache(flagged)
	storeChain(t, tc, chain, newLoader())

	emptyLinkCache(tc)
	loaded, err := newLoader().Load()
	require.NoError(t, err)
	require.False(t, loaded.wasFullyCached, "the tip's key state was computed over stubs")
	require.False(t, loaded.GetLastLink().GetSigCheckCache().SkippedStubs)

	emptyLinkCache(tc)
	loaded, err = newLoader().Load()
	require.NoError(t, err)
	require.True(t, loaded.wasFullyCached, "the recomputed key state should have been stored")
	require.False(t, loaded.GetLastLink().GetSigCheckCache().SkippedStubs)
}

// A chain that keeps being loaded keeps all of its stored links across DB
// cleaner passes, whether a load got a link from the LinkCache or from disk.
func TestLoadedChainSurvivesCleaner(t *testing.T) {
	tc := SetupTest(t, "loaded_chain_cleaner", 1)
	defer tc.Cleanup()

	chain, newLoader := resetChain(t, tc)
	storeChain(t, tc, chain, newLoader())

	emptyLinkCache(tc)
	_, err := newLoader().Load()
	require.NoError(t, err)
	// This pass forgets every use so far, so only the next load keeps records.
	require.NoError(t, tc.G.LocalDb.Clean(true))

	// The LinkCache evicts on its own schedule, so a load usually finds some
	// links cached and reads the rest from disk.
	for i, link := range chain.chainLinks {
		if i%2 == 0 {
			tc.G.LinkCache().Remove(link.id)
		}
	}
	_, err = newLoader().Load()
	require.NoError(t, err)
	require.NoError(t, tc.G.LocalDb.Clean(true))

	// A load that found a gap would go to the server, which this chain isn't on.
	emptyLinkCache(tc)
	loaded, err := newLoader().Load()
	require.NoError(t, err)
	require.Len(t, loaded.chainLinks, len(chain.chainLinks))
}
