// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/base64"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// makeStubbedTrackLink returns a stubbed track link the way a stubbed sigchain
// load hands it to Store: outer link only, verified, no payload.
func makeStubbedTrackLink(t *testing.T, g *GlobalContext) *ChainLink {
	prev, err := RandBytes(LinkIDLen)
	require.NoError(t, err)
	curr, err := RandBytes(LinkIDLen)
	require.NoError(t, err)
	raw, err := OuterLinkV2{
		Version:  KeybaseSignatureV2,
		Seqno:    7,
		Prev:     LinkID(prev),
		Curr:     LinkID(curr),
		LinkType: SigchainV2TypeTrack,
		SeqType:  keybase1.SeqType_PUBLIC,
	}.Encode()
	require.NoError(t, err)

	link := NewChainLink(g, nil, nil)
	require.NoError(t, link.unpackStubbed(base64.StdEncoding.EncodeToString(raw)))
	require.True(t, link.IsStubbed())
	link.chainVerified = true
	return link
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

	link := makeStubbedTrackLink(t, tc.G)
	_, err := link.Store(m)
	require.NoError(t, err)

	followee := keybase1.UID("295a7eea607af32040647123732bc819")
	follower := &keybase1.UserPlusKeysV2AllIncarnations{
		Current: keybase1.UserPlusKeysV2{
			Uid: keybase1.UID("2ff3e34ad9c4e1bd9f2a0e5f43f10719"),
			RemoteTracks: map[keybase1.UID]keybase1.RemoteTrack{
				followee: {Username: "testuser", Uid: followee, LinkID: keybase1.LinkID(link.id.String())},
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

	link := makeStubbedTrackLink(t, tc.G)
	full := []byte(`{"sig":"full-link-sig","payload_json":"{}"}`)
	require.NoError(t, tc.G.LocalDb.PutRaw(DbKey{Typ: DBLink, Key: link.id.String()}, full))
	// A load caches each link from the server before storing it.
	putLinkToCache(m, link)

	didStore, err := link.Store(m)
	require.NoError(t, err)
	// Reported as stored so SigChain.Store keeps walking to older links.
	require.True(t, didStore)
	require.Equal(t, string(full), string(storedLinkRecord(t, tc.G, link.id)))
	_, cached := tc.G.LinkCache().Get(link.id)
	require.False(t, cached, "the cached stub would hide the full link on disk")
}

func TestStoreKeepsFullLinkWithStubKeyState(t *testing.T) {
	tc := SetupTest(t, "stubbed_store_cki", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	link := makeStubbedTrackLink(t, tc.G)
	require.NoError(t, tc.G.LocalDb.PutRaw(DbKey{Typ: DBLink, Key: link.id.String()}, []byte(`{"sig":"full-link-sig","payload_json":"{}"}`)))
	// The tail of a load carries the chain's computed key state.
	link.PutSigCheckCache(NewComputedKeyInfos(tc.G))

	_, err := link.Store(m)
	require.NoError(t, err)
	stored := string(storedLinkRecord(t, tc.G, link.id))
	require.Contains(t, stored, `"sig":"full-link-sig"`)
	require.Contains(t, stored, `"computed_key_infos"`)
	require.NotContains(t, stored, `"s2"`)
}

func TestStoreReplacesUnreadableRecordWithStub(t *testing.T) {
	tc := SetupTest(t, "stubbed_store_junk", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	link := makeStubbedTrackLink(t, tc.G)
	require.NoError(t, tc.G.LocalDb.PutRaw(DbKey{Typ: DBLink, Key: link.id.String()}, []byte(`{"junk":1}`)))

	_, err := link.Store(m)
	require.NoError(t, err)
	require.Contains(t, string(storedLinkRecord(t, tc.G, link.id)), `"s2"`)
}

func TestParseTrackChainLinkStubbedLink(t *testing.T) {
	tc := SetupTest(t, "stubbed_parse", 1)
	defer tc.Cleanup()

	// Payload readers chain jsonw lookups on UnmarshalPayloadJSON; a stub
	// must make them fail, not crash.
	_, err := ParseTrackChainLink(GenericChainLink{makeStubbedTrackLink(t, tc.G)})
	require.Error(t, err)
}

func TestLinkCacheKeepsFullLinkOverStub(t *testing.T) {
	tc := SetupTest(t, "stubbed_cache", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)
	c := NewLinkCache(10, time.Hour)
	defer c.Shutdown()

	stub := *makeStubbedTrackLink(t, tc.G)
	full := stub.Copy()
	full.unpacked = &ChainLinkUnpacked{}

	c.Put(m, full.id, full)
	c.Put(m, stub.id, stub)
	got, ok := c.Get(stub.id)
	require.True(t, ok)
	require.False(t, got.IsStubbed())

	// The other direction is how a forced unstubbed reload heals the cache.
	c.Remove(stub.id)
	c.Put(m, stub.id, stub)
	c.Put(m, full.id, full)
	got, ok = c.Get(stub.id)
	require.True(t, ok)
	require.False(t, got.IsStubbed())
}
