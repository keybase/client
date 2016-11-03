// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type privateMetadataFuture struct {
	PrivateMetadata
	Dir dirEntryFuture
	extra
}

func (pmf privateMetadataFuture) toCurrent() PrivateMetadata {
	pm := pmf.PrivateMetadata
	pm.Dir = DirEntry(pmf.Dir.toCurrent())
	pm.Changes.Ops = make(opsList, len(pmf.Changes.Ops))
	for i, opFuture := range pmf.Changes.Ops {
		currentOp := opFuture.(futureStruct).toCurrentStruct()
		// A generic version of "v := currentOp; ...Ops[i] = &v".
		v := reflect.New(reflect.TypeOf(currentOp))
		v.Elem().Set(reflect.ValueOf(currentOp))
		pm.Changes.Ops[i] = v.Interface().(op)
	}
	return pm
}

func (pmf privateMetadataFuture) toCurrentStruct() currentStruct {
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
			codec.UnknownFieldSetHandler{},
			BlockChanges{},
		},
		makeFakeDirEntryFuture(t),
		makeExtraOrBust("PrivateMetadata", t),
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

func makeImmutableRootMetadataForTest(
	t *testing.T, rmd *RootMetadata, key kbfscrypto.VerifyingKey,
	mdID MdID) ImmutableRootMetadata {
	brmdv2 := rmd.bareMd.(*BareRootMetadataV2)
	vk := brmdv2.WriterMetadataSigInfo.VerifyingKey
	require.True(t, vk == (kbfscrypto.VerifyingKey{}) || vk == key,
		"Writer signature %s with unexpected non-nil verifying key != %s",
		brmdv2.WriterMetadataSigInfo, key)
	brmdv2.WriterMetadataSigInfo = kbfscrypto.SignatureInfo{
		VerifyingKey: key,
	}
	return MakeImmutableRootMetadata(rmd, key, mdID, time.Now())
}

// Test that GetTlfHandle() and MakeBareTlfHandle() work properly for
// public TLFs.
func TestRootMetadataGetTlfHandlePublic(t *testing.T) {
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
	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
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
	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey(crypto)

	dirHandle := rmd.GetTlfHandle()
	require.Equal(t, h, dirHandle)

	rmd.tlfHandle = nil
	bh, err := rmd.MakeBareTlfHandle()
	require.NoError(t, err)
	require.Equal(t, h.ToBareHandleOrBust(), bh)
}

// Test that key generations work as expected for private TLFs.
func TestRootMetadataLatestKeyGenerationPrivate(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	tlfID := tlf.FakeID(0, false)
	h := makeFakeTlfHandle(t, 14, false, nil, nil)
	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
	require.NoError(t, err)

	if rmd.LatestKeyGeneration() != 0 {
		t.Errorf("Expected key generation to be invalid (0)")
	}
	rmd.fakeInitialRekey(crypto)
	if rmd.LatestKeyGeneration() != FirstValidKeyGen {
		t.Errorf("Expected key generation to be valid(%d)", FirstValidKeyGen)
	}
}

// Test that key generations work as expected for public TLFs.
func TestRootMetadataLatestKeyGenerationPublic(t *testing.T) {
	tlfID := tlf.FakeID(0, true)
	h := makeFakeTlfHandle(t, 14, true, nil, nil)
	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
	require.NoError(t, err)

	if rmd.LatestKeyGeneration() != PublicKeyGen {
		t.Errorf("Expected key generation to be public (%d)", PublicKeyGen)
	}
}

// Test that old encoded WriterMetadata objects (i.e., without any
// extra fields) can be deserialized and serialized to the same form,
// which is important for RootMetadata.IsValidAndSigned().
func TestWriterMetadataUnchangedEncoding(t *testing.T) {
	encodedWm := []byte{
		0x89, 0xa3, 0x42, 0x49, 0x44, 0xc4, 0x10, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0xa9,
		0x44, 0x69, 0x73, 0x6b, 0x55, 0x73, 0x61, 0x67,
		0x65, 0x64, 0xa2, 0x49, 0x44, 0xc4, 0x10, 0x1,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x16, 0xb3,
		0x4c, 0x61, 0x73, 0x74, 0x4d, 0x6f, 0x64, 0x69,
		0x66, 0x79, 0x69, 0x6e, 0x67, 0x57, 0x72, 0x69,
		0x74, 0x65, 0x72, 0xa4, 0x75, 0x69, 0x64, 0x31,
		0xa8, 0x52, 0x65, 0x66, 0x42, 0x79, 0x74, 0x65,
		0x73, 0x63, 0xaa, 0x55, 0x6e, 0x72, 0x65, 0x66,
		0x42, 0x79, 0x74, 0x65, 0x73, 0x65, 0xa6, 0x57,
		0x46, 0x6c, 0x61, 0x67, 0x73, 0xa, 0xa7, 0x57,
		0x72, 0x69, 0x74, 0x65, 0x72, 0x73, 0x92, 0xa4,
		0x75, 0x69, 0x64, 0x31, 0xa4, 0x75, 0x69, 0x64,
		0x32, 0xa4, 0x64, 0x61, 0x74, 0x61, 0xc4, 0x2,
		0xa, 0xb,
	}

	expectedWm := WriterMetadataV2{
		SerializedPrivateMetadata: []byte{0xa, 0xb},
		LastModifyingWriter:       "uid1",
		Writers:                   []keybase1.UID{"uid1", "uid2"},
		ID:                        tlf.FakeID(1, false),
		BID:                       NullBranchID,
		WFlags:                    0xa,
		DiskUsage:                 100,
		RefBytes:                  99,
		UnrefBytes:                101,
	}

	c := kbfscodec.NewMsgpack()

	var wm WriterMetadataV2
	err := c.Decode(encodedWm, &wm)
	require.NoError(t, err)

	require.Equal(t, expectedWm, wm)

	buf, err := c.Encode(wm)
	require.NoError(t, err)
	require.Equal(t, encodedWm, buf)
}

// Test that WriterMetadata has only a fixed (frozen) set of fields.
func TestWriterMetadataEncodedFields(t *testing.T) {
	sa1, _ := externals.NormalizeSocialAssertion("uid1@twitter")
	sa2, _ := externals.NormalizeSocialAssertion("uid2@twitter")
	// Usually exactly one of Writers/WKeys is filled in, but we
	// fill in both here for testing.
	wm := WriterMetadataV2{
		ID:      tlf.FakeID(0xa, false),
		Writers: []keybase1.UID{"uid1", "uid2"},
		WKeys:   TLFWriterKeyGenerations{{}},
		Extra: WriterMetadataExtra{
			UnresolvedWriters: []keybase1.SocialAssertion{sa1, sa2},
		},
	}

	c := kbfscodec.NewMsgpack()

	buf, err := c.Encode(wm)
	require.NoError(t, err)

	var m map[string]interface{}
	err = c.Decode(buf, &m)
	require.NoError(t, err)

	expectedFields := []string{
		"BID",
		"DiskUsage",
		"ID",
		"LastModifyingWriter",
		"RefBytes",
		"UnrefBytes",
		"WFlags",
		"WKeys",
		"Writers",
		"data",
		"x",
	}

	var fields []string
	for field := range m {
		fields = append(fields, field)
	}
	sort.Strings(fields)
	require.Equal(t, expectedFields, fields)
}

type writerMetadataExtraFuture struct {
	WriterMetadataExtra
	extra
}

func (wmef writerMetadataExtraFuture) toCurrent() WriterMetadataExtra {
	return wmef.WriterMetadataExtra
}

type tlfWriterKeyGenerationsFuture []*tlfWriterKeyBundleFuture

func (wkgf tlfWriterKeyGenerationsFuture) toCurrent() TLFWriterKeyGenerations {
	wkg := make(TLFWriterKeyGenerations, len(wkgf))
	for i, wkbf := range wkgf {
		wkb := wkbf.toCurrent()
		wkg[i] = wkb
	}
	return wkg
}

type writerMetadataFuture struct {
	WriterMetadataV2
	// Override WriterMetadata.WKeys.
	WKeys tlfWriterKeyGenerationsFuture
	// Override WriterMetadata.Extra.
	Extra writerMetadataExtraFuture `codec:"x,omitempty,omitemptycheckstruct"`
}

func (wmf writerMetadataFuture) toCurrent() WriterMetadataV2 {
	wm := wmf.WriterMetadataV2
	wm.WKeys = wmf.WKeys.toCurrent()
	wm.Extra = wmf.Extra.toCurrent()
	return wm
}

func (wmf writerMetadataFuture) toCurrentStruct() currentStruct {
	return wmf.toCurrent()
}

func makeFakeWriterMetadataFuture(t *testing.T) writerMetadataFuture {
	wmd := WriterMetadataV2{
		// This needs to be list format so it fails to compile if new fields
		// are added, effectively checking at compile time whether new fields
		// have been added
		[]byte{0xa, 0xb},
		"uid1",
		[]keybase1.UID{"uid1", "uid2"},
		nil,
		tlf.FakeID(1, false),
		NullBranchID,
		0xa,
		100,
		99,
		101,
		WriterMetadataExtra{},
	}
	wkb := makeFakeTLFWriterKeyBundleFuture(t)
	sa, _ := externals.NormalizeSocialAssertion("foo@twitter")
	return writerMetadataFuture{
		wmd,
		tlfWriterKeyGenerationsFuture{&wkb},
		writerMetadataExtraFuture{
			WriterMetadataExtra{
				// This needs to be list format so it fails to compile if new
				// fields are added, effectively checking at compile time
				// whether new fields have been added
				[]keybase1.SocialAssertion{sa},
				codec.UnknownFieldSetHandler{},
			},
			makeExtraOrBust("WriterMetadata", t),
		},
	}
}

func TestWriterMetadataUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeWriterMetadataFuture(t))
}

type tlfReaderKeyGenerationsFuture []*tlfReaderKeyBundleFuture

func (rkgf tlfReaderKeyGenerationsFuture) toCurrent() TLFReaderKeyGenerations {
	rkg := make(TLFReaderKeyGenerations, len(rkgf))
	for i, rkbf := range rkgf {
		rkb := rkbf.toCurrent()
		rkg[i] = rkb
	}
	return rkg
}

// rootMetadataWrapper exists only to add extra depth to fields
// in RootMetadata, so that they may be overridden in
// rootMetadataFuture.
type bareRootMetadataWrapper struct {
	BareRootMetadataV2
}

type bareRootMetadataFuture struct {
	// Override BareRootMetadata.WriterMetadata. Put it first to work
	// around a bug in codec's field lookup code.
	//
	// TODO: Report and fix this bug upstream.
	writerMetadataFuture

	bareRootMetadataWrapper
	// Override BareRootMetadata.RKeys.
	RKeys tlfReaderKeyGenerationsFuture `codec:",omitempty"`
	extra
}

func (brmf *bareRootMetadataFuture) toCurrent() BareRootMetadata {
	rm := brmf.bareRootMetadataWrapper.BareRootMetadataV2
	rm.WriterMetadataV2 = WriterMetadataV2(brmf.writerMetadataFuture.toCurrent())
	rm.RKeys = brmf.RKeys.toCurrent()
	return &rm
}

func (brmf *bareRootMetadataFuture) toCurrentStruct() currentStruct {
	return brmf.toCurrent()
}

func makeFakeBareRootMetadataFuture(t *testing.T) *bareRootMetadataFuture {
	wmf := makeFakeWriterMetadataFuture(t)
	rkb := makeFakeTLFReaderKeyBundleFuture(t)
	h, err := kbfshash.DefaultHash([]byte("fake buf"))
	require.NoError(t, err)
	sa, _ := externals.NormalizeSocialAssertion("bar@github")
	rmf := bareRootMetadataFuture{
		wmf,
		bareRootMetadataWrapper{
			BareRootMetadataV2{
				// This needs to be list format so it
				// fails to compile if new fields are
				// added, effectively checking at
				// compile time whether new fields
				// have been added
				WriterMetadataV2{},
				kbfscrypto.SignatureInfo{
					Version:      100,
					Signature:    []byte{0xc},
					VerifyingKey: kbfscrypto.MakeFakeVerifyingKeyOrBust("fake kid"),
				},
				"uid1",
				0xb,
				5,
				MdID{h},
				nil,
				[]keybase1.SocialAssertion{sa},
				nil,
				nil,
				codec.UnknownFieldSetHandler{},
			},
		},
		[]*tlfReaderKeyBundleFuture{&rkb},
		makeExtraOrBust("BareRootMetadata", t),
	}
	return &rmf
}

func TestBareRootMetadataUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeBareRootMetadataFuture(t))
}

func TestMakeRekeyReadError(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer config.Shutdown()

	tlfID := tlf.FakeID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice", false)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey(config.Crypto())

	u, uid, err := config.KBPKI().Resolve(context.Background(), "bob")
	require.NoError(t, err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen, uid, u)
	require.Equal(t, NewReadAccessError(h, u, "/keybase/private/alice"), err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen, h.FirstResolvedWriter(), "alice")
	require.Equal(t, NeedSelfRekeyError{"alice"}, err)

	// MDv3 TODO: This case will no longer be valid. We'll expect the error to be NeedSelfRekeyError.
	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen+1, h.FirstResolvedWriter(), "alice")
	require.Equal(t, NeedOtherRekeyError{"alice"}, err)
}

func TestMakeRekeyReadErrorResolvedHandle(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer config.Shutdown()

	tlfID := tlf.FakeID(1, false)
	ctx := context.Background()
	h, err := ParseTlfHandle(ctx, config.KBPKI(), "alice,bob@twitter",
		false)
	require.NoError(t, err)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)

	rmd.fakeInitialRekey(config.Crypto())

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
	tlfID := tlf.FakeID(0, true)
	h := makeFakeTlfHandle(t, 14, true, nil, nil)
	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
	require.NoError(t, err)

	rmd.SetFinalBit()
	_, err = rmd.MakeSuccessor(context.Background(), nil, fakeMdID(1), true)
	_, isFinalError := err.(MetadataIsFinalError)
	require.Equal(t, isFinalError, true)
}

func getAllUsersKeysForTest(
	t *testing.T, config Config, rmd *RootMetadata, un string) []kbfscrypto.TLFCryptKey {
	var keys []kbfscrypto.TLFCryptKey
	for i := 1; i <= int(rmd.LatestKeyGeneration()); i++ {
		key, err := config.KeyManager().(*KeyManagerStandard).getTLFCryptKeyUsingCurrentDevice(
			context.Background(), rmd, KeyGen(i), true)
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
	require.Equal(t, rmd.LatestKeyGeneration(), KeyGen(0))
	require.Equal(t, rmd.Revision(), MetadataRevision(1))
	require.Equal(t, rmd.Version(), InitialExtraMetadataVer)

	// set some dummy numbers
	diskUsage, refBytes, unrefBytes := uint64(12345), uint64(4321), uint64(1234)
	rmd.SetDiskUsage(diskUsage)
	rmd.SetRefBytes(refBytes)
	rmd.SetUnrefBytes(unrefBytes)

	// key it once
	done, _, err := config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, rmd.LatestKeyGeneration(), KeyGen(1))
	require.Equal(t, rmd.Revision(), MetadataRevision(1))
	require.Equal(t, rmd.Version(), InitialExtraMetadataVer)

	// prove charlie
	config.KeybaseService().(*KeybaseDaemonLocal).addNewAssertionForTestOrBust(
		"charlie", "charlie@twitter")

	// rekey it
	done, _, err = config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, rmd.LatestKeyGeneration(), KeyGen(1))
	require.Equal(t, rmd.Revision(), MetadataRevision(1))
	require.Equal(t, rmd.Version(), InitialExtraMetadataVer)

	// revoke bob's device
	_, bobUID, err := config.KBPKI().Resolve(context.Background(), "bob")
	require.NoError(t, err)
	RevokeDeviceForLocalUserOrBust(t, config, bobUID, 0)

	// rekey it
	done, _, err = config.KeyManager().Rekey(context.Background(), rmd, false)
	require.NoError(t, err)
	require.True(t, done)
	require.Equal(t, rmd.LatestKeyGeneration(), KeyGen(2))
	require.Equal(t, rmd.Revision(), MetadataRevision(1))
	require.Equal(t, rmd.Version(), InitialExtraMetadataVer)

	// override the metadata version
	config.metadataVersion = SegregatedKeyBundlesVer

	// create an MDv3 successor
	rmd2, err := rmd.MakeSuccessor(context.Background(), config, fakeMdID(1), true)
	require.NoError(t, err)
	require.Equal(t, rmd2.LatestKeyGeneration(), KeyGen(2))
	require.Equal(t, rmd2.Revision(), MetadataRevision(2))
	require.Equal(t, rmd2.Version(), SegregatedKeyBundlesVer)

	// compare numbers
	require.Equal(t, diskUsage, rmd2.DiskUsage())
	require.Equal(t, refBytes, rmd2.RefBytes())
	require.Equal(t, unrefBytes, rmd2.UnrefBytes())

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
	require.Equal(t, len(keys), 2)

	keys2, err := config.KeyManager().GetTLFCryptKeyOfAllGenerations(context.Background(), rmd2)
	require.NoError(t, err)
	require.Equal(t, len(keys2), 2)
	require.Equal(t, keys2, keys)

	// get each key generation for alice from each version of metadata
	aliceKeys := getAllUsersKeysForTest(t, config, rmd, "alice")
	aliceKeys2 := getAllUsersKeysForTest(t, config, rmd2, "alice")

	// compare alice's keys
	require.Equal(t, len(aliceKeys), 2)
	require.Equal(t, aliceKeys, aliceKeys2)

	// get each key generation for charlie from each version of metadata
	config2 := ConfigAsUser(config, "charlie")
	config2.SetKeyCache(&dummyNoKeyCache{})
	defer config2.Shutdown()
	charlieKeys := getAllUsersKeysForTest(t, config2, rmd, "charlie")
	charlieKeys2 := getAllUsersKeysForTest(t, config2, rmd2, "charlie")

	// compare charlie's keys
	require.Equal(t, len(charlieKeys), 2)
	require.Equal(t, charlieKeys, charlieKeys2)

	// compare alice and charlie's keys
	require.Equal(t, aliceKeys, charlieKeys)
}

// Test upconversion from MDv2 to MDv3 for a public folder.
func TestRootMetadataUpconversionPublic(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer config.Shutdown()

	tlfID := tlf.FakeID(1, true)
	h := parseTlfHandleOrBust(t, config, "alice,bob,charlie@twitter", true)
	rmd, err := makeInitialRootMetadata(InitialExtraMetadataVer, tlfID, h)
	require.NoError(t, err)
	require.Equal(t, rmd.LatestKeyGeneration(), PublicKeyGen)
	require.Equal(t, rmd.Revision(), MetadataRevision(1))
	require.Equal(t, rmd.Version(), InitialExtraMetadataVer)

	// set some dummy numbers
	diskUsage, refBytes, unrefBytes := uint64(12345), uint64(4321), uint64(1234)
	rmd.SetDiskUsage(diskUsage)
	rmd.SetRefBytes(refBytes)
	rmd.SetUnrefBytes(unrefBytes)

	// override the metadata version
	config.metadataVersion = SegregatedKeyBundlesVer

	// create an MDv3 successor
	rmd2, err := rmd.MakeSuccessor(context.Background(), config, fakeMdID(1), true)
	require.NoError(t, err)
	require.Equal(t, rmd2.LatestKeyGeneration(), PublicKeyGen)
	require.Equal(t, rmd2.Revision(), MetadataRevision(2))
	require.Equal(t, rmd2.Version(), SegregatedKeyBundlesVer)

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
