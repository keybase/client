// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"sort"
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
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

func newRootMetadataOrBust(
	t *testing.T, tlfID TlfID, h *TlfHandle) *RootMetadata {
	rmd := NewRootMetadata()
	err := rmd.Update(tlfID, h.ToBareHandleOrBust())
	require.NoError(t, err)
	rmd.tlfHandle = h
	return rmd
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
	tlfID := FakeTlfID(0, true)
	rmd := newRootMetadataOrBust(t, tlfID, h)

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
	tlfID := FakeTlfID(0, false)
	rmd := newRootMetadataOrBust(t, tlfID, h)
	rmd.FakeInitialRekey(crypto, h.ToBareHandleOrBust())

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
	tlfID := FakeTlfID(0, false)
	h := makeFakeTlfHandle(t, 14, false, nil, nil)
	rmd := newRootMetadataOrBust(t, tlfID, h)
	if rmd.LatestKeyGeneration() != 0 {
		t.Errorf("Expected key generation to be invalid (0)")
	}
	rmd.FakeInitialRekey(crypto, h.ToBareHandleOrBust())
	if rmd.LatestKeyGeneration() != FirstValidKeyGen {
		t.Errorf("Expected key generation to be valid(%d)", FirstValidKeyGen)
	}
}

// Test that key generations work as expected for public TLFs.
func TestRootMetadataLatestKeyGenerationPublic(t *testing.T) {
	tlfID := FakeTlfID(0, true)
	h := makeFakeTlfHandle(t, 14, true, nil, nil)
	rmd := newRootMetadataOrBust(t, tlfID, h)
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
		ID:                        FakeTlfID(1, false),
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
		ID:      FakeTlfID(0xa, false),
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
		FakeTlfID(1, false),
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
					VerifyingKey: MakeFakeVerifyingKeyOrBust("fake kid"),
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

func TestIsValidRekeyRequestBasic(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice")
	defer config.Shutdown()

	// Sign the writer metadata
	id := FakeTlfID(1, false)

	h := parseTlfHandleOrBust(t, config, "alice", false)
	rmd := newRootMetadataOrBust(t, id, h)

	buf, err := rmd.GetSerializedWriterMetadata(config.Codec())
	if err != nil {
		t.Fatal(err)
	}
	sigInfo, err := config.Crypto().Sign(context.Background(), buf)
	if err != nil {
		t.Fatal(err)
	}
	rmd.SetWriterMetadataSigInfo(sigInfo)

	// Copy bit unset.
	newRmd := newRootMetadataOrBust(t, id, h)
	// MDv3 TODO: pass reader key bundles
	ok, err := newRmd.bareMd.IsValidRekeyRequest(
		config.Codec(), rmd.bareMd, newRmd.LastModifyingWriter(), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("Expected invalid rekey request due to unset copy bit")
	}

	// Set the copy bit; note the writer metadata is the same.
	newRmd.SetWriterMetadataCopiedBit()

	// Writer metadata siginfo mismatch.
	config2 := MakeTestConfigOrBust(t, "bob")
	defer config2.Shutdown()

	buf, err = newRmd.GetSerializedWriterMetadata(config2.Codec())
	if err != nil {
		t.Fatal(err)
	}
	sigInfo2, err := config2.Crypto().Sign(context.Background(), buf)
	if err != nil {
		t.Fatal(err)
	}
	newRmd.SetWriterMetadataSigInfo(sigInfo2)
	// MDv3 TODO: pass reader key bundles
	ok, err = newRmd.bareMd.IsValidRekeyRequest(
		config.Codec(), rmd.bareMd, newRmd.LastModifyingWriter(), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("Expected invalid rekey request due to mismatched writer metadata siginfo")
	}

	// Replace with copied signature.
	newRmd.SetWriterMetadataSigInfo(sigInfo)
	// MDv3 TODO: pass reader key bundles
	ok, err = newRmd.bareMd.IsValidRekeyRequest(
		config.Codec(), rmd.bareMd, newRmd.LastModifyingWriter(), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("Expected valid rekey request")
	}
}

func TestRootMetadataVersion(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob", "charlie")
	defer config.Shutdown()

	// Sign the writer metadata
	id := FakeTlfID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,bob@twitter", false)
	rmd := newRootMetadataOrBust(t, id, h)
	rmds := RootMetadataSigned{MD: rmd.bareMd}
	if g, e := rmds.Version(), config.MetadataVersion(); g != e {
		t.Errorf("MD with unresolved users got wrong version %d, expected %d",
			g, e)
	}

	// All other folders should use the pre-extra MD version.
	id2 := FakeTlfID(2, false)
	h2 := parseTlfHandleOrBust(t, config, "alice,charlie", false)
	rmd2 := newRootMetadataOrBust(t, id2, h2)
	rmds2 := RootMetadataSigned{MD: rmd2.bareMd}
	if g, e := rmds2.Version(), MetadataVer(PreExtraMetadataVer); g != e {
		t.Errorf("MD without unresolved users got wrong version %d, "+
			"expected %d", g, e)
	}

	// ... including if the assertions get resolved.
	AddNewAssertionForTestOrBust(t, config, "bob", "bob@twitter")
	rmd.SetSerializedPrivateMetadata([]byte{1}) // MakeSuccessor requires this
	rmd.FakeInitialRekey(config.Crypto(), h.ToBareHandleOrBust())
	if rmd.GetSerializedPrivateMetadata() == nil {
		t.Fatalf("Nil private MD")
	}
	h3, err := h.ResolveAgain(context.Background(), config.KBPKI())
	if err != nil {
		t.Fatalf("Couldn't resolve again: %v", err)
	}
	rmd3, err := rmd.MakeSuccessor(config.Codec(), fakeMdID(1), true)
	if err != nil {
		t.Fatalf("Couldn't make MD successor: %v", err)
	}
	rmd3.FakeInitialRekey(config.Crypto(), h3.ToBareHandleOrBust())
	err = rmd3.updateFromTlfHandle(h3)
	if err != nil {
		t.Fatalf("Couldn't update TLF handle: %v", err)
	}
	rmds3 := RootMetadataSigned{MD: rmd3.bareMd}
	if g, e := rmds3.Version(), MetadataVer(PreExtraMetadataVer); g != e {
		t.Errorf("MD without unresolved users got wrong version %d, "+
			"expected %d", g, e)
	}
}

func TestMakeRekeyReadError(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer config.Shutdown()

	id := FakeTlfID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice", false)
	rmd := newRootMetadataOrBust(t, id, h)
	rmd.FakeInitialRekey(config.Crypto(), h.ToBareHandleOrBust())

	u, uid, err := config.KBPKI().Resolve(context.Background(), "bob")
	require.NoError(t, err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen, uid, u)
	require.Equal(t, NewReadAccessError(h, u), err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen, h.FirstResolvedWriter(), "alice")
	require.Equal(t, NeedSelfRekeyError{"alice"}, err)

	// MDv3 TODO: This case will no longer be valid. We'll expect the error to be NeedSelfRekeyError.
	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen+1, h.FirstResolvedWriter(), "alice")
	require.Equal(t, NeedOtherRekeyError{"alice"}, err)
}

func TestMakeRekeyReadErrorResolvedHandle(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer config.Shutdown()

	id := FakeTlfID(1, false)
	ctx := context.Background()
	h, err := ParseTlfHandle(ctx, config.KBPKI(), "alice,bob@twitter",
		false)
	require.NoError(t, err)
	rmd := newRootMetadataOrBust(t, id, h)
	rmd.FakeInitialRekey(config.Crypto(), h.ToBareHandleOrBust())

	u, uid, err := config.KBPKI().Resolve(ctx, "bob")
	require.NoError(t, err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), h, FirstValidKeyGen, uid, u)
	require.Equal(t, NewReadAccessError(h, u), err)

	config.KeybaseService().(*KeybaseDaemonLocal).addNewAssertionForTestOrBust(
		"bob", "bob@twitter")

	resolvedHandle, err := h.ResolveAgain(ctx, config.KBPKI())
	require.NoError(t, err)

	err = makeRekeyReadErrorHelper(rmd.ReadOnly(), resolvedHandle, FirstValidKeyGen, uid, u)
	require.Equal(t, NeedOtherRekeyError{"alice,bob"}, err)
}

// Test that MakeSuccessor fails when the final bit is set.
func TestRootMetadataFinalIsFinal(t *testing.T) {
	tlfID := FakeTlfID(0, true)
	h := makeFakeTlfHandle(t, 14, true, nil, nil)
	rmd := newRootMetadataOrBust(t, tlfID, h)
	rmd.SetFinalBit()
	_, err := rmd.MakeSuccessor(nil, fakeMdID(1), true)
	_, isFinalError := err.(MetadataIsFinalError)
	require.Equal(t, isFinalError, true)
}

// Test verification of finalized metadata blocks.
func TestRootMetadataFinalVerify(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice")
	defer config.Shutdown()

	// create and sign a revision
	id := FakeTlfID(1, false)
	handle := parseTlfHandleOrBust(t, config, "alice", false)
	h, err := handle.ToBareHandle()
	if err != nil {
		t.Fatal(err)
	}
	rmds, err := NewRootMetadataSignedForTest(id, h)
	if err != nil {
		t.Fatal(err)
	}
	rmds.MD.FakeInitialRekey(config.Crypto(), h)
	rmds.MD.SetLastModifyingWriter(h.Writers[0])
	rmds.MD.SetLastModifyingUser(h.Writers[0])
	rmds.MD.SetSerializedPrivateMetadata([]byte{42})

	buf, err := rmds.MD.GetSerializedWriterMetadata(config.Codec())
	if err != nil {
		t.Fatal(err)
	}
	sigInfo, err := config.Crypto().Sign(context.Background(), buf)
	if err != nil {
		t.Fatal(err)
	}
	rmds.MD.SetWriterMetadataSigInfo(sigInfo)
	buf, err = config.Codec().Encode(rmds.MD)
	if err != nil {
		t.Fatal(err)
	}
	sigInfo, err = config.Crypto().Sign(context.Background(), buf)
	if err != nil {
		t.Fatal(err)
	}
	rmds.SigInfo = sigInfo

	// verify it
	// MDv3 TODO: pass key bundles
	err = rmds.IsValidAndSigned(config.Codec(), config.Crypto(), nil)
	if err != nil {
		t.Fatal(err)
	}

	// make a final copy
	rmds2, err := rmds.MakeFinalCopy(config.Codec())
	if err != nil {
		t.Fatal(err)
	}

	// add the extension
	fi, err := NewTestTlfHandleExtensionStaticTime(TlfHandleExtensionFinalized, 1, "test")
	if err != nil {
		t.Fatal(err)
	}
	rmds2.MD.SetFinalizedInfo(fi)

	// verify the finalized copy
	// MDv3 TODO: pass key bundles
	err = rmds2.IsValidAndSigned(config.Codec(), config.Crypto(), nil)
	if err != nil {
		t.Fatal(err)
	}

	// touch something the server shouldn't be allowed to edit for finalized metadata
	// and verify verification failure.
	rmds2.MD.SetRekeyBit()
	// MDv3 TODO: pass key bundles
	err = rmds2.IsValidAndSigned(config.Codec(), config.Crypto(), nil)
	if err == nil {
		t.Fatalf("expected error")
	}
}
