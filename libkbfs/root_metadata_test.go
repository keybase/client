// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type privateMetadataFuture struct {
	PrivateMetadata
	Dir dirEntryFuture
	kbfscodec.Extra
}

func (pmf privateMetadataFuture) toCurrent() PrivateMetadata {
	pm := pmf.PrivateMetadata
	pm.Dir = DirEntry(pmf.Dir.toCurrent())
	pm.Changes.Ops = make(opsList, len(pmf.Changes.Ops))
	for i, opFuture := range pmf.Changes.Ops {
		currentOp := opFuture.(kbfscodec.FutureStruct).ToCurrentStruct()
		// A generic version of "v := currentOp; ...Ops[i] = &v".
		v := reflect.New(reflect.TypeOf(currentOp))
		v.Elem().Set(reflect.ValueOf(currentOp))
		pm.Changes.Ops[i] = v.Interface().(op)
	}
	return pm
}

func (pmf privateMetadataFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return pmf.toCurrent()
}

func makeFakePrivateMetadataFuture(t *testing.T) privateMetadataFuture {
	createOp := makeFakeCreateOpFuture(t)
	rmOp := makeFakeRmOpFuture(t)
	renameOp := makeFakeRenameOpFuture(t)
	syncOp := makeFakeSyncOpFuture(t)
	setAttrOp := makeFakeSetAttrOpFuture(t)
	resolutionOp := makeFakeResolutionOpFuture(t)
	rekeyOp := makeFakeRekeyOpFuture(t)
	gcOp := makeFakeGcOpFuture(t)

	pmf := privateMetadataFuture{
		PrivateMetadata{
			DirEntry{},
			kbfscrypto.MakeTLFPrivateKey([32]byte{0xb}),
			BlockChanges{
				makeFakeBlockInfo(t),
				opsList{
					&createOp,
					&rmOp,
					&renameOp,
					&syncOp,
					&setAttrOp,
					&resolutionOp,
					&rekeyOp,
					&gcOp,
				},
				0,
			},
			0,
			codec.UnknownFieldSetHandler{},
			BlockChanges{},
		},
		makeFakeDirEntryFuture(t),
		kbfscodec.MakeExtraOrBust("PrivateMetadata", t),
	}
	return pmf
}

func TestPrivateMetadataUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakePrivateMetadataFuture(t))
}

// makeFakeTlfHandle should only be used in this file.
func makeFakeTlfHandle(
	t *testing.T, x uint32, public bool,
	unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion) *TlfHandle {
	uid := keybase1.MakeTestUID(x)
	return &TlfHandle{
		public: public,
		resolvedWriters: map[keybase1.UID]libkb.NormalizedUsername{
			uid: "test_user",
		},
		unresolvedWriters: unresolvedWriters,
		unresolvedReaders: unresolvedReaders,
	}
}

// Test that GetTlfHandle() and MakeBareTlfHandle() work properly for
// public TLFs.
func TestRootMetadataGetTlfHandlePublic(t *testing.T) {
	runTestOverMetadataVers(t, testRootMetadataGetTlfHandlePublic)
}

func testRootMetadataGetTlfHandlePublic(t *testing.T, ver MetadataVer) {
	uw := []keybase1.SocialAssertion{
		{
			User:    "user2",
			Service: "service3",
		},
		{
			User:    "user1",
			Service: "service1",
		},
	}
	h := makeFakeTlfHandle(t, 14, true, uw, nil)
	tlfID := tlf.FakeID(0, true)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	dirHandle := rmd.GetTlfHandle()
	require.Equal(t, h, dirHandle)

	rmd.tlfHandle = nil
	bh, err := rmd.MakeBareTlfHandle()
	require.NoError(t, err)
	require.Equal(t, h.ToBareHandleOrBust(), bh)
}

// Test that GetTlfHandle() and MakeBareTlfHandle() work properly for
// non-public TLFs.
func TestRootMetadataGetTlfHandlePrivate(t *testing.T) {
	runTestOverMetadataVers(t, testRootMetadataGetTlfHandlePrivate)
}

func testRootMetadataGetTlfHandlePrivate(t *testing.T, ver MetadataVer) {
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	uw := []keybase1.SocialAssertion{
		{
			User:    "user2",
			Service: "service3",
		},
		{
			User:    "user1",
			Service: "service1",
		},
	}
	ur := []keybase1.SocialAssertion{
		{
			User:    "user5",
			Service: "service3",
		},
		{
			User:    "user1",
			Service: "service2",
		},
	}
	h := makeFakeTlfHandle(t, 14, false, uw, ur)
	tlfID := tlf.FakeID(0, false)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey(codec, crypto)

	dirHandle := rmd.GetTlfHandle()
	require.Equal(t, h, dirHandle)

	rmd.tlfHandle = nil
	bh, err := rmd.MakeBareTlfHandle()
	require.NoError(t, err)
	require.Equal(t, h.ToBareHandleOrBust(), bh)
}

// Test that key generations work as expected for private TLFs.
func TestRootMetadataLatestKeyGenerationPrivate(t *testing.T) {
	runTestOverMetadataVers(t, testRootMetadataLatestKeyGenerationPrivate)
}

func testRootMetadataLatestKeyGenerationPrivate(t *testing.T, ver MetadataVer) {
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	tlfID := tlf.FakeID(0, false)
	h := makeFakeTlfHandle(t, 14, false, nil, nil)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	if rmd.LatestKeyGeneration() != 0 {
		t.Errorf("Expected key generation to be invalid (0)")
	}
	rmd.fakeInitialRekey(codec, crypto)
	if rmd.LatestKeyGeneration() != FirstValidKeyGen {
		t.Errorf("Expected key generation to be valid(%d)", FirstValidKeyGen)
	}
}

// Test that key generations work as expected for public TLFs.
func TestRootMetadataLatestKeyGenerationPublic(t *testing.T) {
	runTestOverMetadataVers(t, testRootMetadataLatestKeyGenerationPublic)
}

func testRootMetadataLatestKeyGenerationPublic(t *testing.T, ver MetadataVer) {
	tlfID := tlf.FakeID(0, true)
	h := makeFakeTlfHandle(t, 14, true, nil, nil)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	if rmd.LatestKeyGeneration() != PublicKeyGen {
		t.Errorf("Expected key generation to be public (%d)", PublicKeyGen)
	}
}

func TestMakeRekeyReadError(t *testing.T) {
	runTestOverMetadataVers(t, testMakeRekeyReadError)
}

func testMakeRekeyReadError(t *testing.T, ver MetadataVer) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	config.SetMetadataVersion(ver)
	defer config.Shutdown()

	tlfID := tlf.FakeID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice", false)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey(config.Codec(), config.Crypto())

	u, uid, err := config.KBPKI().Resolve(context.Background(), "bob")
	require.NoError(t, err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen, uid, u)
	require.Equal(t, NewReadAccessError(h, u, "/keybase/private/alice"), err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen, h.FirstResolvedWriter(), "alice")
	require.Equal(t, NeedSelfRekeyError{"alice"}, err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen+1, h.FirstResolvedWriter(), "alice")
	if ver < SegregatedKeyBundlesVer {
		require.Equal(t, NeedOtherRekeyError{"alice"}, err)
	} else {
		require.Equal(t, NeedSelfRekeyError{"alice"}, err)
	}
}

func TestMakeRekeyReadErrorResolvedHandle(t *testing.T) {
	runTestOverMetadataVers(t, testMakeRekeyReadErrorResolvedHandle)
}

func testMakeRekeyReadErrorResolvedHandle(t *testing.T, ver MetadataVer) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer config.Shutdown()

	tlfID := tlf.FakeID(1, false)
	ctx := context.Background()
	h, err := ParseTlfHandle(ctx, config.KBPKI(), "alice,bob@twitter",
		false)
	require.NoError(t, err)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey(config.Codec(), config.Crypto())

	u, uid, err := config.KBPKI().Resolve(ctx, "bob")
	require.NoError(t, err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen, uid, u)
	require.Equal(t, NewReadAccessError(h, u, "/keybase/private/alice,bob@twitter"), err)

	config.KeybaseService().(*KeybaseDaemonLocal).addNewAssertionForTestOrBust(
		"bob", "bob@twitter")

	resolvedHandle, err := h.ResolveAgain(ctx, config.KBPKI())
	require.NoError(t, err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), resolvedHandle, FirstValidKeyGen, uid, u)
	require.Equal(t, NeedOtherRekeyError{"alice,bob"}, err)
}

// Test that MakeSuccessor fails when the final bit is set.
func TestRootMetadataFinalIsFinal(t *testing.T) {
	runTestOverMetadataVers(t, testRootMetadataFinalIsFinal)
}

func testRootMetadataFinalIsFinal(t *testing.T, ver MetadataVer) {
	tlfID := tlf.FakeID(0, true)
	h := makeFakeTlfHandle(t, 14, true, nil, nil)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	rmd.SetFinalBit()
	_, err = rmd.MakeSuccessor(context.Background(), -1, nil, nil, nil,
		fakeMdID(1), true)
	_, isFinalError := err.(MetadataIsFinalError)
	require.Equal(t, isFinalError, true)
}

func getAllUsersKeysForTest(
	t *testing.T, config Config, rmd *RootMetadata, un string) []kbfscrypto.TLFCryptKey {
	var keys []kbfscrypto.TLFCryptKey
	for keyGen := FirstValidKeyGen; keyGen <= rmd.LatestKeyGeneration(); keyGen++ {
		key, err := config.KeyManager().(*KeyManagerStandard).getTLFCryptKeyUsingCurrentDevice(
			context.Background(), rmd, keyGen, true)
		require.NoError(t, err)
		keys = append(keys, key)
	}
	return keys
}

// We always want misses for the tests below.
type dummyNoKeyCache struct {
}

func (kc *dummyNoKeyCache) GetTLFCryptKey(_ tlf.ID, _ KeyGen) (kbfscrypto.TLFCryptKey, error) {
	return kbfscrypto.TLFCryptKey{}, KeyCacheMissError{}
}

func (kc *dummyNoKeyCache) PutTLFCryptKey(_ tlf.ID, _ KeyGen, _ kbfscrypto.TLFCryptKey) error {
	return nil
}

// Test upconversion from MDv2 to MDv3 for a private folder.
func TestRootMetadataUpconversionPrivate(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob", "charlie")
	config.SetKeyCache(&dummyNoKeyCache{})
	defer config.Shutdown()

	tlfID := tlf.FakeID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,alice@twitter#bob,charlie@twitter,eve@reddit", false)
	rmd, err := makeInitialRootMetadata(InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)
	require.Equal(t, KeyGen(0), rmd.LatestKeyGeneration())
	require.Equal(t, MetadataRevision(1), rmd.Revision())
	require.Equal(t, InitialExtraMetadataVer, rmd.Version())

	// set some dummy numbers
	diskUsage, refBytes, unrefBytes := uint64(12345), uint64(4321), uint64(1234)
	rmd.SetDiskUsage(diskUsage)
	rmd.SetRefBytes(refBytes)
	rmd.SetUnrefBytes(unrefBytes)
	// Make sure the MD looks readable.
	rmd.data.Dir.BlockPointer = BlockPointer{ID: fakeBlockID(1)}

	// key it once
	done, _, err := config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, KeyGen(1), rmd.LatestKeyGeneration())
	require.Equal(t, MetadataRevision(1), rmd.Revision())
	require.Equal(t, InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 0, len(rmd.bareMd.(*BareRootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))
	require.Equal(t, 1, len(rmd.bareMd.(*BareRootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))

	// revoke bob's device
	_, bobUID, err := config.KBPKI().Resolve(context.Background(), "bob")
	require.NoError(t, err)
	RevokeDeviceForLocalUserOrBust(t, config, bobUID, 0)

	// rekey it
	done, _, err = config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, KeyGen(2), rmd.LatestKeyGeneration())
	require.Equal(t, MetadataRevision(1), rmd.Revision())
	require.Equal(t, InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 0, len(rmd.bareMd.(*BareRootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))
	require.Equal(t, 1, len(rmd.bareMd.(*BareRootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))

	// prove charlie
	config.KeybaseService().(*KeybaseDaemonLocal).addNewAssertionForTestOrBust(
		"charlie", "charlie@twitter")

	// rekey it
	done, _, err = config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, KeyGen(2), rmd.LatestKeyGeneration())
	require.Equal(t, MetadataRevision(1), rmd.Revision())
	require.Equal(t, InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 0, len(rmd.bareMd.(*BareRootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))
	require.Equal(t, 2, len(rmd.bareMd.(*BareRootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))

	// add a device for charlie and rekey as charlie
	_, charlieUID, err := config.KBPKI().Resolve(context.Background(), "charlie")
	config2 := ConfigAsUser(config, "charlie")
	config2.SetKeyCache(&dummyNoKeyCache{})
	defer config2.Shutdown()
	AddDeviceForLocalUserOrBust(t, config, charlieUID)
	AddDeviceForLocalUserOrBust(t, config2, charlieUID)

	// rekey it
	done, _, err = config2.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, KeyGen(2), rmd.LatestKeyGeneration())
	require.Equal(t, MetadataRevision(1), rmd.Revision())
	require.Equal(t, InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 1, len(rmd.bareMd.(*BareRootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))
	require.Equal(t, 2, len(rmd.bareMd.(*BareRootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))

	// override the metadata version
	config.metadataVersion = SegregatedKeyBundlesVer

	// create an MDv3 successor
	rmd2, err := rmd.MakeSuccessor(context.Background(),
		config.MetadataVersion(), config.Codec(), config.Crypto(),
		config.KeyManager(), fakeMdID(1), true)
	require.NoError(t, err)
	require.Equal(t, KeyGen(2), rmd2.LatestKeyGeneration())
	require.Equal(t, MetadataRevision(2), rmd2.Revision())
	require.Equal(t, SegregatedKeyBundlesVer, rmd2.Version())
	extra, ok := rmd2.extra.(*ExtraMetadataV3)
	require.True(t, ok)
	require.True(t, extra.wkbNew)
	require.True(t, extra.rkbNew)

	// compare numbers
	require.Equal(t, diskUsage, rmd2.DiskUsage())
	require.Equal(t, rmd.data.Dir, rmd2.data.Dir)

	// These should be 0 since they are reset for successors.
	require.Equal(t, uint64(0), rmd2.RefBytes())
	require.Equal(t, uint64(0), rmd2.UnrefBytes())

	// create and compare bare tlf handles (this verifies unresolved+resolved writer/reader sets are identical)
	rmd.tlfHandle, rmd2.tlfHandle = nil, nil // avoid a panic due to the handle already existing
	handle, err := rmd.MakeBareTlfHandle()
	require.NoError(t, err)
	handle2, err := rmd2.MakeBareTlfHandle()
	require.NoError(t, err)
	require.Equal(t, handle, handle2)

	// compare tlf crypt keys
	keys, err := config.KeyManager().GetTLFCryptKeyOfAllGenerations(context.Background(), rmd)
	require.NoError(t, err)
	require.Equal(t, 2, len(keys))

	keys2, err := config.KeyManager().GetTLFCryptKeyOfAllGenerations(context.Background(), rmd2)
	require.NoError(t, err)
	require.Equal(t, 2, len(keys2))
	require.Equal(t, keys, keys2)

	// get each key generation for alice from each version of metadata
	aliceKeys := getAllUsersKeysForTest(t, config, rmd, "alice")
	aliceKeys2 := getAllUsersKeysForTest(t, config, rmd2, "alice")

	// compare alice's keys
	require.Equal(t, 2, len(aliceKeys))
	require.Equal(t, aliceKeys, aliceKeys2)

	// get each key generation for charlie from each version of metadata
	charlieKeys := getAllUsersKeysForTest(t, config2, rmd, "charlie")
	charlieKeys2 := getAllUsersKeysForTest(t, config2, rmd2, "charlie")

	// compare charlie's keys
	require.Equal(t, 2, len(charlieKeys))
	require.Equal(t, charlieKeys, charlieKeys2)

	// compare alice and charlie's keys
	require.Equal(t, aliceKeys, charlieKeys)

	// Rekeying again shouldn't change wkbNew/rkbNew.
	err = rmd2.finalizeRekey(config.Crypto())
	require.NoError(t, err)
	extra, ok = rmd2.extra.(*ExtraMetadataV3)
	require.True(t, ok)
	require.True(t, extra.wkbNew)
	require.True(t, extra.rkbNew)
}

// Test upconversion from MDv2 to MDv3 for a public folder.
func TestRootMetadataUpconversionPublic(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer config.Shutdown()

	tlfID := tlf.FakeID(1, true)
	h := parseTlfHandleOrBust(t, config, "alice,bob,charlie@twitter", true)
	rmd, err := makeInitialRootMetadata(InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)
	require.Equal(t, PublicKeyGen, rmd.LatestKeyGeneration())
	require.Equal(t, MetadataRevision(1), rmd.Revision())
	require.Equal(t, InitialExtraMetadataVer, rmd.Version())

	// set some dummy numbers
	diskUsage, refBytes, unrefBytes := uint64(12345), uint64(4321), uint64(1234)
	rmd.SetDiskUsage(diskUsage)
	rmd.SetRefBytes(refBytes)
	rmd.SetUnrefBytes(unrefBytes)

	// override the metadata version
	config.metadataVersion = SegregatedKeyBundlesVer

	// create an MDv3 successor
	rmd2, err := rmd.MakeSuccessor(context.Background(),
		config.MetadataVersion(), config.Codec(), config.Crypto(),
		config.KeyManager(), fakeMdID(1), true)
	require.NoError(t, err)
	require.Equal(t, PublicKeyGen, rmd2.LatestKeyGeneration())
	require.Equal(t, MetadataRevision(2), rmd2.Revision())
	require.Equal(t, SegregatedKeyBundlesVer, rmd2.Version())
	// Do this instead of require.Nil because we want to assert
	// that it's untyped nil.
	require.True(t, rmd2.extra == nil)

	// compare numbers
	require.Equal(t, diskUsage, rmd2.DiskUsage())
	// we expect this and the below to be zero this time because the folder is public.
	// they aren't reset in the private version because the private metadata isn't
	// initialized therefor it's considered unreadable.
	require.Equal(t, uint64(0), rmd2.RefBytes())
	require.Equal(t, uint64(0), rmd2.UnrefBytes())

	// create and compare bare tlf handles (this verifies unresolved+resolved writer sets are identical)
	rmd.tlfHandle, rmd2.tlfHandle = nil, nil // avoid a panic due to the handle already existing
	handle, err := rmd.MakeBareTlfHandle()
	require.NoError(t, err)
	handle2, err := rmd2.MakeBareTlfHandle()
	require.NoError(t, err)
	require.Equal(t, handle, handle2)
}

// The server will be reusing IsLastModifiedBy and we don't want a client
// to be able to construct an MD that will crash the server.
func TestRootMetadataV3NoPanicOnWriterMismatch(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer config.Shutdown()

	_, uid, err := config.KBPKI().Resolve(context.Background(), "alice")
	tlfID := tlf.FakeID(0, false)
	h := makeFakeTlfHandle(t, 14, false, nil, nil)
	rmd, err := makeInitialRootMetadata(SegregatedKeyBundlesVer, tlfID, h)
	require.NoError(t, err)
	rmd.fakeInitialRekey(config.Codec(), config.Crypto())
	rmd.SetLastModifyingWriter(uid)
	rmd.SetLastModifyingUser(uid)

	// sign with a mismatched writer
	config2 := ConfigAsUser(config, "bob")
	defer config2.Shutdown()
	rmds, err := SignBareRootMetadata(
		context.Background(), config.Codec(), config.Crypto(), config2.Crypto(), rmd.bareMd, time.Now())
	require.NoError(t, err)

	// verify last modifier
	vk, err := config.KBPKI().GetCurrentVerifyingKey(context.Background())
	require.NoError(t, err)
	vk2, err := config2.KBPKI().GetCurrentVerifyingKey(context.Background())
	require.NoError(t, err)

	err = rmds.IsLastModifiedBy(uid, vk)
	require.Equal(t, fmt.Errorf("Last writer verifying key %s != %s", vk2.String(), vk.String()), err)
}

// Test that a reader can't upconvert a private folder from v2 to v3.
func TestRootMetadataReaderUpconversionPrivate(t *testing.T) {
	configWriter := MakeTestConfigOrBust(t, "alice", "bob")
	configWriter.SetKeyCache(&dummyNoKeyCache{})
	defer configWriter.Shutdown()

	tlfID := tlf.FakeID(1, false)
	h := parseTlfHandleOrBust(t, configWriter, "alice#bob", false)
	rmd, err := makeInitialRootMetadata(InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)
	require.Equal(t, rmd.LatestKeyGeneration(), KeyGen(0))
	require.Equal(t, rmd.Revision(), MetadataRevision(1))
	require.Equal(t, rmd.Version(), PreExtraMetadataVer)

	// set some dummy numbers
	diskUsage, refBytes, unrefBytes := uint64(12345), uint64(4321), uint64(1234)
	rmd.SetDiskUsage(diskUsage)
	rmd.SetRefBytes(refBytes)
	rmd.SetUnrefBytes(unrefBytes)

	// Have the writer key it first.
	done, _, err := configWriter.KeyManager().Rekey(
		context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, rmd.LatestKeyGeneration(), KeyGen(1))
	require.Equal(t, rmd.Revision(), MetadataRevision(1))
	require.Equal(t, rmd.Version(), PreExtraMetadataVer)
	require.Equal(t, len(rmd.bareMd.(*BareRootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys), 0)
	require.Equal(t, len(rmd.bareMd.(*BareRootMetadataV2).WKeys[0].TLFEphemeralPublicKeys), 1)

	// Set the private MD, to make sure it gets copied properly during
	// upconversion.
	_, aliceUID, err := configWriter.KBPKI().Resolve(
		context.Background(), "alice")
	require.NoError(t, err)
	err = encryptMDPrivateData(context.Background(), configWriter.Codec(),
		configWriter.Crypto(), configWriter.Crypto(),
		configWriter.KeyManager(), aliceUID, rmd)
	require.NoError(t, err)

	// add a device for bob and rekey as bob
	_, bobUID, err := configWriter.KBPKI().Resolve(context.Background(), "bob")
	require.NoError(t, err)
	configReader := ConfigAsUser(configWriter, "bob")
	configReader.SetKeyCache(&dummyNoKeyCache{})
	defer configReader.Shutdown()
	AddDeviceForLocalUserOrBust(t, configWriter, bobUID)
	AddDeviceForLocalUserOrBust(t, configReader, bobUID)

	// Override the metadata version, make a successor, and rekey as
	// reader.  This should keep the version the same, since readers
	// can't upconvert.
	configReader.metadataVersion = SegregatedKeyBundlesVer
	rmd2, err := rmd.MakeSuccessor(context.Background(),
		configReader.MetadataVersion(), configReader.Codec(),
		configReader.Crypto(), configReader.KeyManager(),
		fakeMdID(1), false)
	require.NoError(t, err)
	require.Equal(t, rmd2.LatestKeyGeneration(), KeyGen(1))
	require.Equal(t, rmd2.Revision(), MetadataRevision(2))
	require.Equal(t, rmd2.Version(), PreExtraMetadataVer)
	// Do this instead of require.Nil because we want to assert
	// that it's untyped nil.
	require.True(t, rmd2.extra == nil)
	done, _, err = configReader.KeyManager().Rekey(
		context.Background(), rmd2, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, rmd2.LatestKeyGeneration(), KeyGen(1))
	require.Equal(t, rmd2.Revision(), MetadataRevision(2))
	require.Equal(t, rmd2.Version(), PreExtraMetadataVer)
	require.True(t, rmd2.IsWriterMetadataCopiedSet())
	require.True(t, bytes.Equal(rmd.GetSerializedPrivateMetadata(),
		rmd2.GetSerializedPrivateMetadata()))

	rmds, err := SignBareRootMetadata(context.Background(),
		configReader.Codec(), configReader.Crypto(), configReader.Crypto(),
		rmd2.bareMd, configReader.Clock().Now())
	require.NoError(t, err)
	err = rmds.IsValidAndSigned(configReader.Codec(), configReader.Crypto(),
		rmd2.extra)
	require.NoError(t, err)
}
