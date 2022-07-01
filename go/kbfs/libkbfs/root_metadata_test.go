// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"fmt"
	"reflect"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

var testMetadataVers = []kbfsmd.MetadataVer{
	kbfsmd.InitialExtraMetadataVer, kbfsmd.ImplicitTeamsVer,
}

// runTestOverMetadataVers runs the given test function over all
// metadata versions to test. The test is assumed to be parallelizable
// with other instances of itself. Example use:
//
// func TestFoo(t *testing.T) {
//	runTestOverMetadataVers(t, testFoo)
// }
//
// func testFoo(t *testing.T, ver MetadataVer) {
//	...
// 	brmd, err := MakeInitialRootMetadata(ver, ...)
//	...
// }
func runTestOverMetadataVers(
	t *testing.T, f func(t *testing.T, ver kbfsmd.MetadataVer)) {
	for _, ver := range testMetadataVers {
		ver := ver // capture range variable.
		t.Run(ver.String(), func(t *testing.T) {
			f(t, ver)
		})
	}
}

// runTestsOverMetadataVers runs the given list of test functions over
// all metadata versions to test. prefix should be the common prefix
// for all the test function names, and the names of the subtest will
// be taken to be the strings after that prefix. Example use:
//
// func TestFoo(t *testing.T) {
// 	tests := []func(*testing.T, kbfsmd.MetadataVer){
//		testFooBar1,
//		testFooBar2,
//		testFooBar3,
//		...
//	}
//	runTestsOverMetadataVers(t, "testFoo", tests)
// }
func runTestsOverMetadataVers(t *testing.T, prefix string,
	fs []func(t *testing.T, ver kbfsmd.MetadataVer)) {
	for _, f := range fs {
		f := f // capture range variable.
		name := runtime.FuncForPC(reflect.ValueOf(f).Pointer()).Name()
		i := strings.LastIndex(name, prefix)
		if i >= 0 {
			i += len(prefix)
		} else {
			i = 0
		}
		name = name[i:]
		t.Run(name, func(t *testing.T) {
			runTestOverMetadataVers(t, f)
		})
	}
}

// runBenchmarkOverMetadataVers runs the given benchmark function over
// all metadata versions to test. Example use:
//
// func BenchmarkFoo(b *testing.B) {
//	runBenchmarkOverMetadataVers(b, testFoo)
// }
//
// func benchmarkFoo(b *testing.B, ver kbfsmd.MetadataVer) {
//	...
// 	brmd, err := MakeInitialRootMetadata(ver, ...)
//	...
// }
func runBenchmarkOverMetadataVers(
	b *testing.B, f func(b *testing.B, ver kbfsmd.MetadataVer)) {
	for _, ver := range testMetadataVers {
		ver := ver // capture range variable.
		b.Run(ver.String(), func(b *testing.B) {
			f(b, ver)
		})
	}
}

// TODO: Add way to test with all possible (ver, maxVer) combos,
// e.g. for upconversion tests.

type privateMetadataFuture struct {
	PrivateMetadata
	kbfscodec.Extra
}

func (pmf privateMetadataFuture) toCurrent() PrivateMetadata {
	pm := pmf.PrivateMetadata
	pm.Dir = pmf.Dir
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
			data.DirEntry{},
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
		kbfscodec.MakeExtraOrBust("PrivateMetadata", t),
	}
	return pmf
}

func TestPrivateMetadataUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakePrivateMetadataFuture(t))
}

// makeFakeTlfHandle should only be used in this file.
func makeFakeTlfHandle(
	t *testing.T, x uint32, ty tlf.Type,
	unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion) *tlfhandle.Handle {
	id := keybase1.MakeTestUID(x).AsUserOrTeam()
	return tlfhandle.NewHandle(
		ty, map[keybase1.UserOrTeamID]kbname.NormalizedUsername{
			id: "test_user",
		}, unresolvedWriters, unresolvedReaders, "", tlf.NullID)
}

// Test that GetTlfHandle() and MakeBareTlfHandle() work properly for
// public TLFs.
func testRootMetadataGetTlfHandlePublic(t *testing.T, ver kbfsmd.MetadataVer) {
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
	h := makeFakeTlfHandle(t, 14, tlf.Public, uw, nil)
	tlfID := tlf.FakeID(0, tlf.Public)
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
func testRootMetadataGetTlfHandlePrivate(t *testing.T, ver kbfsmd.MetadataVer) {
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
	h := makeFakeTlfHandle(t, 14, tlf.Private, uw, ur)
	tlfID := tlf.FakeID(0, tlf.Private)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey()

	dirHandle := rmd.GetTlfHandle()
	require.Equal(t, h, dirHandle)

	rmd.tlfHandle = nil
	bh, err := rmd.MakeBareTlfHandle()
	require.NoError(t, err)
	require.Equal(t, h.ToBareHandleOrBust(), bh)
}

// Test that key generations work as expected for private TLFs.
func testRootMetadataLatestKeyGenerationPrivate(t *testing.T, ver kbfsmd.MetadataVer) {
	tlfID := tlf.FakeID(0, tlf.Private)
	h := makeFakeTlfHandle(t, 14, tlf.Private, nil, nil)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	if rmd.LatestKeyGeneration() != 0 {
		t.Errorf("Expected key generation to be invalid (0)")
	}
	rmd.fakeInitialRekey()
	if rmd.LatestKeyGeneration() != kbfsmd.FirstValidKeyGen {
		t.Errorf("Expected key generation to be valid(%d)", kbfsmd.FirstValidKeyGen)
	}
}

// Test that key generations work as expected for public TLFs.
func testRootMetadataLatestKeyGenerationPublic(t *testing.T, ver kbfsmd.MetadataVer) {
	tlfID := tlf.FakeID(0, tlf.Public)
	h := makeFakeTlfHandle(t, 14, tlf.Public, nil, nil)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	if rmd.LatestKeyGeneration() != kbfsmd.PublicKeyGen {
		t.Errorf("Expected key generation to be public (%d)", kbfsmd.PublicKeyGen)
	}
}

func testMakeRekeyReadError(t *testing.T, ver kbfsmd.MetadataVer) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice", "bob")
	config.SetMetadataVersion(ver)
	defer CheckConfigAndShutdown(ctx, t, config)

	tlfID := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice", tlf.Private, tlfID)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey()

	u, id, err := config.KBPKI().Resolve(
		ctx, "bob", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	uid, err := id.AsUser()
	require.NoError(t, err)

	dummyErr := errors.New("dummy")
	err = makeRekeyReadErrorHelper(dummyErr, rmd.ReadOnly(), h, uid, u)
	require.Equal(
		t, tlfhandle.NewReadAccessError(h, u, "/keybase/private/alice"), err)

	err = makeRekeyReadErrorHelper(dummyErr,
		rmd.ReadOnly(), h, h.FirstResolvedWriter().AsUserOrBust(), "alice")
	require.Equal(t, NeedSelfRekeyError{"alice", dummyErr}, err)
}

func testMakeRekeyReadErrorResolvedHandle(t *testing.T, ver kbfsmd.MetadataVer) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer CheckConfigAndShutdown(ctx, t, config)

	tlfID := tlf.FakeID(1, tlf.Private)
	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil,
		"alice,bob@twitter", tlf.Private)
	require.NoError(t, err)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey()

	u, id, err := config.KBPKI().Resolve(
		ctx, "bob", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	uid, err := id.AsUser()
	require.NoError(t, err)

	err = makeRekeyReadErrorHelper(errors.New("dummy"),
		rmd.ReadOnly(), h, uid, u)
	require.Equal(t, tlfhandle.NewReadAccessError(
		h, u, "/keybase/private/alice,bob@twitter"), err)

	config.KeybaseService().(*KeybaseDaemonLocal).AddNewAssertionForTestOrBust(
		"bob", "bob@twitter")

	resolvedHandle, err := h.ResolveAgain(ctx, config.KBPKI(), nil, nil)
	require.NoError(t, err)

	dummyErr := errors.New("dummy")
	err = makeRekeyReadErrorHelper(dummyErr,
		rmd.ReadOnly(), resolvedHandle, uid, u)
	require.Equal(t, NeedOtherRekeyError{"alice,bob", dummyErr}, err)
}

// Test that MakeSuccessor fails when the final bit is set.

func testRootMetadataFinalIsFinal(t *testing.T, ver kbfsmd.MetadataVer) {
	tlfID := tlf.FakeID(0, tlf.Public)
	h := makeFakeTlfHandle(t, 14, tlf.Public, nil, nil)
	rmd, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)

	rmd.SetFinalBit()
	_, err = rmd.MakeSuccessor(context.Background(), -1, nil, nil, nil,
		nil, nil, kbfsmd.FakeID(1), true)
	_, isFinalError := err.(kbfsmd.MetadataIsFinalError)
	require.Equal(t, isFinalError, true)
}

func getAllUsersKeysForTest(
	t *testing.T, config Config, rmd *RootMetadata, un string) []kbfscrypto.TLFCryptKey {
	var keys []kbfscrypto.TLFCryptKey
	for keyGen := kbfsmd.FirstValidKeyGen; keyGen <= rmd.LatestKeyGeneration(); keyGen++ {
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

func (kc *dummyNoKeyCache) GetTLFCryptKey(_ tlf.ID, _ kbfsmd.KeyGen) (kbfscrypto.TLFCryptKey, error) {
	return kbfscrypto.TLFCryptKey{}, KeyCacheMissError{}
}

func (kc *dummyNoKeyCache) PutTLFCryptKey(_ tlf.ID, _ kbfsmd.KeyGen, _ kbfscrypto.TLFCryptKey) error {
	return nil
}

// Test upconversion from MDv2 to MDv3 for a private folder.
func TestRootMetadataUpconversionPrivate(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob", "charlie")
	config.SetKeyCache(&dummyNoKeyCache{})
	ctx := context.Background()
	defer CheckConfigAndShutdown(ctx, t, config)

	tlfID := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,alice@twitter#bob,charlie@twitter,eve@reddit", tlf.Private, tlfID)
	rmd, err := makeInitialRootMetadata(kbfsmd.InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.KeyGen(0), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.InitialExtraMetadataVer, rmd.Version())

	// set some dummy numbers
	diskUsage, refBytes, unrefBytes := uint64(12345), uint64(4321), uint64(1234)
	rmd.SetDiskUsage(diskUsage)
	rmd.SetRefBytes(refBytes)
	rmd.SetUnrefBytes(unrefBytes)
	// Make sure the MD looks readable.
	rmd.data.Dir.BlockPointer = data.BlockPointer{ID: kbfsblock.FakeID(1)}

	// key it once
	done, _, err := config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, kbfsmd.KeyGen(1), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 0, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))
	require.Equal(t, 1, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))

	// revoke bob's device
	_, bobID, err := config.KBPKI().Resolve(
		context.Background(), "bob", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	bobUID, err := bobID.AsUser()
	require.NoError(t, err)

	RevokeDeviceForLocalUserOrBust(t, config, bobUID, 0)

	// rekey it
	done, _, err = config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, kbfsmd.KeyGen(2), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 1, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))
	require.Equal(t, 0, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))

	// prove charlie
	config.KeybaseService().(*KeybaseDaemonLocal).AddNewAssertionForTestOrBust(
		"charlie", "charlie@twitter")

	// rekey it
	done, _, err = config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, kbfsmd.KeyGen(2), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 2, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))
	require.Equal(t, 0, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))

	// add a device for charlie and rekey as charlie
	_, charlieID, err := config.KBPKI().Resolve(
		context.Background(), "charlie", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	charlieUID, err := charlieID.AsUser()
	require.NoError(t, err)

	config2 := ConfigAsUser(config, "charlie")
	config2.SetKeyCache(&dummyNoKeyCache{})
	defer CheckConfigAndShutdown(ctx, t, config2)
	AddDeviceForLocalUserOrBust(t, config, charlieUID)
	AddDeviceForLocalUserOrBust(t, config2, charlieUID)

	// rekey it
	done, _, err = config2.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, kbfsmd.KeyGen(2), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 2, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))
	require.Equal(t, 1, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))

	// override the metadata version
	config.metadataVersion = kbfsmd.SegregatedKeyBundlesVer

	// create an MDv3 successor
	rmd2, err := rmd.MakeSuccessor(context.Background(),
		config.MetadataVersion(), config.Codec(),
		config.KeyManager(), config.KBPKI(), config.KBPKI(), nil,
		kbfsmd.FakeID(1), true)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.KeyGen(2), rmd2.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(2), rmd2.Revision())
	require.Equal(t, kbfsmd.SegregatedKeyBundlesVer, rmd2.Version())
	extra, ok := rmd2.extra.(*kbfsmd.ExtraMetadataV3)
	require.True(t, ok)
	require.True(t, extra.IsWriterKeyBundleNew())
	require.True(t, extra.IsReaderKeyBundleNew())

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
	err = rmd2.finalizeRekey(config.Codec())
	require.NoError(t, err)
	extra, ok = rmd2.extra.(*kbfsmd.ExtraMetadataV3)
	require.True(t, ok)
	require.True(t, extra.IsWriterKeyBundleNew())
	require.True(t, extra.IsReaderKeyBundleNew())
}

// Test upconversion from MDv2 to MDv3 for a public folder.
func TestRootMetadataUpconversionPublic(t *testing.T) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer CheckConfigAndShutdown(ctx, t, config)

	tlfID := tlf.FakeID(1, tlf.Public)
	h := parseTlfHandleOrBust(
		t, config, "alice,bob,charlie@twitter", tlf.Public, tlfID)
	rmd, err := makeInitialRootMetadata(kbfsmd.InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.PublicKeyGen, rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.InitialExtraMetadataVer, rmd.Version())

	// set some dummy numbers
	diskUsage, refBytes, unrefBytes := uint64(12345), uint64(4321), uint64(1234)
	rmd.SetDiskUsage(diskUsage)
	rmd.SetRefBytes(refBytes)
	rmd.SetUnrefBytes(unrefBytes)

	// override the metadata version
	config.metadataVersion = kbfsmd.SegregatedKeyBundlesVer

	// create an MDv3 successor
	rmd2, err := rmd.MakeSuccessor(context.Background(),
		config.MetadataVersion(), config.Codec(),
		config.KeyManager(), config.KBPKI(), config.KBPKI(), config,
		kbfsmd.FakeID(1), true)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.PublicKeyGen, rmd2.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(2), rmd2.Revision())
	require.Equal(t, kbfsmd.SegregatedKeyBundlesVer, rmd2.Version())
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

// Test upconversion from MDv2 to MDv3 for a private conflict folder.
// Regression test for KBFS-2381.
func TestRootMetadataUpconversionPrivateConflict(t *testing.T) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer CheckConfigAndShutdown(ctx, t, config)

	tlfID := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(
		t, config, "alice,bob (conflicted copy 2017-08-24)", tlf.Private, tlfID)
	rmd, err := makeInitialRootMetadata(kbfsmd.InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.KeyGen(0), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.InitialExtraMetadataVer, rmd.Version())
	require.NotNil(t, h.ConflictInfo())

	// set some dummy numbers
	diskUsage, refBytes, unrefBytes :=
		uint64(12345), uint64(4321), uint64(1234)
	rmd.SetDiskUsage(diskUsage)
	rmd.SetRefBytes(refBytes)
	rmd.SetUnrefBytes(unrefBytes)
	// Make sure the MD looks readable.
	rmd.data.Dir.BlockPointer = data.BlockPointer{ID: kbfsblock.FakeID(1)}

	// key it once
	done, _, err := config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, kbfsmd.KeyGen(1), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.InitialExtraMetadataVer, rmd.Version())
	require.Equal(t, 0, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))
	require.Equal(t, 1, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))
	require.True(t, rmd.IsReadable())

	// override the metadata version
	config.metadataVersion = kbfsmd.SegregatedKeyBundlesVer

	// create an MDv3 successor
	rmd2, err := rmd.MakeSuccessor(context.Background(),
		config.MetadataVersion(), config.Codec(),
		config.KeyManager(), config.KBPKI(), config.KBPKI(), config,
		kbfsmd.FakeID(1), true)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.KeyGen(1), rmd2.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(2), rmd2.Revision())
	require.Equal(t, kbfsmd.SegregatedKeyBundlesVer, rmd2.Version())
	extra, ok := rmd2.extra.(*kbfsmd.ExtraMetadataV3)
	require.True(t, ok)
	require.True(t, extra.IsWriterKeyBundleNew())
	require.True(t, extra.IsReaderKeyBundleNew())

	// Check the handle, but the cached handle in the MD is a direct copy...
	require.Equal(
		t, h.GetCanonicalPath(), rmd2.GetTlfHandle().GetCanonicalPath())
	// So also check that the conflict info is set in the MD itself.
	require.NotNil(t, rmd2.bareMd.(*kbfsmd.RootMetadataV3).ConflictInfo)
}

// The server will be reusing IsLastModifiedBy and we don't want a client
// to be able to construct an MD that will crash the server.
func TestRootMetadataV3NoPanicOnWriterMismatch(t *testing.T) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer CheckConfigAndShutdown(ctx, t, config)

	_, id, err := config.KBPKI().Resolve(
		context.Background(), "alice", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	uid, err := id.AsUser()
	require.NoError(t, err)

	tlfID := tlf.FakeID(0, tlf.Private)
	h := makeFakeTlfHandle(t, 14, tlf.Private, nil, nil)
	rmd, err := makeInitialRootMetadata(kbfsmd.SegregatedKeyBundlesVer, tlfID, h)
	require.NoError(t, err)
	rmd.fakeInitialRekey()
	rmd.SetLastModifyingWriter(uid)
	rmd.SetLastModifyingUser(uid)

	// sign with a mismatched writer
	config2 := ConfigAsUser(config, "bob")
	defer CheckConfigAndShutdown(ctx, t, config2)
	rmds, err := SignBareRootMetadata(
		context.Background(), config.Codec(), config.Crypto(), config2.Crypto(), rmd.bareMd, time.Now())
	require.NoError(t, err)

	// verify last modifier
	session, err := config.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)

	err = rmds.IsLastModifiedBy(uid, session.VerifyingKey)
	require.EqualError(t, err, fmt.Sprintf("Last writer verifying key %s != %s", session2.VerifyingKey, session.VerifyingKey))
}

// Test that a reader can't upconvert a private folder from v2 to v3.
func TestRootMetadataReaderUpconversionPrivate(t *testing.T) {
	ctx := context.Background()
	configWriter := MakeTestConfigOrBust(t, "alice", "bob")
	configWriter.SetKeyCache(&dummyNoKeyCache{})
	defer CheckConfigAndShutdown(ctx, t, configWriter)

	tlfID := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, configWriter, "alice#bob", tlf.Private, tlfID)
	rmd, err := makeInitialRootMetadata(kbfsmd.InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.KeyGen(0), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.PreExtraMetadataVer, rmd.Version())

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
	require.Equal(t, kbfsmd.KeyGen(1), rmd.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(1), rmd.Revision())
	require.Equal(t, kbfsmd.PreExtraMetadataVer, rmd.Version())
	require.Equal(t, 1, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).WKeys[0].TLFEphemeralPublicKeys))
	require.Equal(t, 0, len(rmd.bareMd.(*kbfsmd.RootMetadataV2).RKeys[0].TLFReaderEphemeralPublicKeys))

	// Set the private MD, to make sure it gets copied properly during
	// upconversion.
	_, aliceID, err := configWriter.KBPKI().Resolve(
		context.Background(), "alice", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	aliceUID, err := aliceID.AsUser()
	require.NoError(t, err)

	err = encryptMDPrivateData(context.Background(), configWriter.Codec(),
		configWriter.Crypto(), configWriter.Crypto(),
		configWriter.KeyManager(), aliceUID, rmd)
	require.NoError(t, err)

	// add a device for bob and rekey as bob
	_, bobID, err := configWriter.KBPKI().Resolve(
		context.Background(), "bob", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	bobUID, err := bobID.AsUser()
	require.NoError(t, err)

	configReader := ConfigAsUser(configWriter, "bob")
	configReader.SetKeyCache(&dummyNoKeyCache{})
	defer CheckConfigAndShutdown(ctx, t, configReader)
	AddDeviceForLocalUserOrBust(t, configWriter, bobUID)
	AddDeviceForLocalUserOrBust(t, configReader, bobUID)

	// Override the metadata version, make a successor, and rekey as
	// reader.  This should keep the version the same, since readers
	// can't upconvert.
	configReader.metadataVersion = kbfsmd.SegregatedKeyBundlesVer
	rmd2, err := rmd.MakeSuccessor(context.Background(),
		configReader.MetadataVersion(), configReader.Codec(),
		configReader.KeyManager(), configReader.KBPKI(),
		configReader.KBPKI(), configReader, kbfsmd.FakeID(1), false)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.KeyGen(1), rmd2.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(2), rmd2.Revision())
	require.Equal(t, kbfsmd.PreExtraMetadataVer, rmd2.Version())
	// Do this instead of require.Nil because we want to assert
	// that it's untyped nil.
	require.True(t, rmd2.extra == nil)
	done, _, err = configReader.KeyManager().Rekey(
		context.Background(), rmd2, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, kbfsmd.KeyGen(1), rmd2.LatestKeyGeneration())
	require.Equal(t, kbfsmd.Revision(2), rmd2.Revision())
	require.Equal(t, kbfsmd.PreExtraMetadataVer, rmd2.Version())
	require.True(t, rmd2.IsWriterMetadataCopiedSet())
	require.True(t, bytes.Equal(rmd.GetSerializedPrivateMetadata(),
		rmd2.GetSerializedPrivateMetadata()))

	rmds, err := SignBareRootMetadata(context.Background(),
		configReader.Codec(), configReader.Crypto(), configReader.Crypto(),
		rmd2.bareMd, configReader.Clock().Now())
	require.NoError(t, err)
	err = rmds.IsValidAndSigned(
		ctx, configReader.Codec(), nil, rmd2.extra,
		keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
}

// Check writer/reader methods with teams
func TestRootMetadataTeamMembership(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob", "charlie")
	ctx := context.Background()
	defer CheckConfigAndShutdown(ctx, t, config)

	teamInfos := AddEmptyTeamsForTestOrBust(t, config, "t1")
	tid := teamInfos[0].TID

	tlfID := tlf.FakeID(1, tlf.SingleTeam)
	h := tlfhandle.NewHandle(
		tlf.SingleTeam,
		map[keybase1.UserOrTeamID]kbname.NormalizedUsername{
			tid.AsUserOrTeam(): "t1",
		}, nil, nil, "t1", tlf.NullID)
	rmd, err := makeInitialRootMetadata(kbfsmd.InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)

	getUser := func(name string) (keybase1.UID, kbfscrypto.VerifyingKey) {
		_, id, err := config.KBPKI().Resolve(
			context.Background(), name, keybase1.OfflineAvailability_NONE)
		require.NoError(t, err)
		uid, err := id.AsUser()
		require.NoError(t, err)

		userInfo, err := config.KeybaseService().LoadUserPlusKeys(
			context.Background(), uid, keybase1.KID(""),
			keybase1.OfflineAvailability_NONE)
		require.NoError(t, err)

		return uid, userInfo.VerifyingKeys[0]
	}
	aliceUID, aliceKey := getUser("alice")
	bobUID, bobKey := getUser("bob")
	charlieUID, charlieKey := getUser("charlie")

	// No user should be able to read this yet.
	checkWriter := func(uid keybase1.UID, key kbfscrypto.VerifyingKey,
		expectedIsWriter bool) {
		isWriter, err := rmd.IsWriter(ctx, config.KBPKI(), config, uid, key)
		require.NoError(t, err)
		require.Equal(t, expectedIsWriter, isWriter)
	}
	checkReader := func(uid keybase1.UID, expectedIsReader bool) {
		isReader, err := rmd.IsReader(ctx, config.KBPKI(), config, uid)
		require.NoError(t, err)
		require.Equal(t, expectedIsReader, isReader)
	}
	checkWriter(aliceUID, aliceKey, false)
	checkWriter(bobUID, bobKey, false)
	checkWriter(charlieUID, charlieKey, false)
	checkReader(aliceUID, false)
	checkReader(bobUID, false)
	checkReader(charlieUID, false)

	// Make bob a writer.
	AddTeamWriterForTestOrBust(t, config, tid, bobUID)
	checkWriter(aliceUID, aliceKey, false)
	checkWriter(bobUID, bobKey, true)
	checkWriter(charlieUID, charlieKey, false)
	checkReader(aliceUID, false)
	checkReader(bobUID, true)
	checkReader(charlieUID, false)

	// Make alice a writer, and charlie a reader.
	AddTeamWriterForTestOrBust(t, config, tid, aliceUID)
	AddTeamReaderForTestOrBust(t, config, tid, charlieUID)
	checkWriter(aliceUID, aliceKey, true)
	checkWriter(bobUID, bobKey, true)
	checkWriter(charlieUID, charlieKey, false)
	checkReader(aliceUID, true)
	checkReader(bobUID, true)
	checkReader(charlieUID, true)

	// Promote charlie to writer.
	AddTeamWriterForTestOrBust(t, config, tid, charlieUID)
	checkWriter(aliceUID, aliceKey, true)
	checkWriter(bobUID, bobKey, true)
	checkWriter(charlieUID, charlieKey, true)
	checkReader(aliceUID, true)
	checkReader(bobUID, true)
	checkReader(charlieUID, true)
}

// Check that MakeSuccessor gets the right key gen for teams.
func TestRootMetadataTeamMakeSuccessor(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice")
	ctx := context.Background()
	defer CheckConfigAndShutdown(ctx, t, config)

	teamInfos := AddEmptyTeamsForTestOrBust(t, config, "t1")
	tid := teamInfos[0].TID

	tlfID := tlf.FakeID(1, tlf.SingleTeam)
	h := tlfhandle.NewHandle(
		tlf.SingleTeam,
		map[keybase1.UserOrTeamID]kbname.NormalizedUsername{
			tid.AsUserOrTeam(): "t1",
		}, nil, nil, "t1", tlf.NullID)
	rmd, err := makeInitialRootMetadata(kbfsmd.SegregatedKeyBundlesVer, tlfID, h)
	require.NoError(t, err)
	rmd.bareMd.SetLatestKeyGenerationForTeamTLF(teamInfos[0].LatestKeyGen)
	// Make sure the MD looks readable.
	rmd.data.Dir.BlockPointer = data.BlockPointer{ID: kbfsblock.FakeID(1)}

	firstKeyGen := rmd.LatestKeyGeneration()
	require.Equal(t, kbfsmd.FirstValidKeyGen, firstKeyGen)

	rmd2, err := rmd.MakeSuccessor(context.Background(),
		config.MetadataVersion(), config.Codec(),
		config.KeyManager(), config.KBPKI(), config.KBPKI(), config,
		kbfsmd.FakeID(1), true)
	require.NoError(t, err)

	// No increase yet.
	kg := rmd2.LatestKeyGeneration()
	require.Equal(t, firstKeyGen, kg)

	AddTeamKeyForTestOrBust(t, config, tid)

	rmd3, err := rmd2.MakeSuccessor(context.Background(),
		config.MetadataVersion(), config.Codec(),
		config.KeyManager(), config.KBPKI(), config.KBPKI(), config,
		kbfsmd.FakeID(2), true)
	require.NoError(t, err)

	// Should have been bumped by one.
	kg = rmd3.LatestKeyGeneration()
	require.Equal(t, firstKeyGen+1, kg)
}

func TestRootMetadata(t *testing.T) {
	tests := []func(*testing.T, kbfsmd.MetadataVer){
		testRootMetadataGetTlfHandlePublic,
		testRootMetadataGetTlfHandlePrivate,
		testRootMetadataLatestKeyGenerationPrivate,
		testRootMetadataLatestKeyGenerationPublic,
		testMakeRekeyReadError,
		testMakeRekeyReadErrorResolvedHandle,
		testRootMetadataFinalIsFinal,
	}
	runTestsOverMetadataVers(t, "testRootMetadata", tests)
}
