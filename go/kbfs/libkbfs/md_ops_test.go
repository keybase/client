// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	merkle "github.com/keybase/go-merkle-tree"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type shimCrypto struct {
	Crypto
	pure cryptoPure
	key  kbfscrypto.SigningKey
}

func (c shimCrypto) Sign(
	ctx context.Context, data []byte) (kbfscrypto.SignatureInfo, error) {
	return c.key.Sign(data), nil
}

func (c shimCrypto) SignForKBFS(
	ctx context.Context, data []byte) (kbfscrypto.SignatureInfo, error) {
	return c.key.SignForKBFS(data)
}

func (c shimCrypto) Verify(
	msg []byte, sigInfo kbfscrypto.SignatureInfo) (err error) {
	return kbfscrypto.Verify(msg, sigInfo)
}

func injectShimCrypto(config Config) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("test key")
	crypto := shimCrypto{
		config.Crypto(),
		MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1()),
		signingKey,
	}
	config.SetCrypto(crypto)
}

func mdOpsInit(t *testing.T, ver kbfsmd.MetadataVer) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	config.SetMetadataVersion(ver)
	mdops := NewMDOpsStandard(config)
	config.SetMDOps(mdops)
	config.SetCodec(kbfscodec.NewMsgpack())
	config.SetKeyBundleCache(kbfsmd.NewKeyBundleCacheLRU(0))
	config.mockMdserv.EXPECT().OffsetFromServerTime().
		Return(time.Duration(0), true).AnyTimes()
	config.mockClock.EXPECT().Now().Return(time.Now()).AnyTimes()
	injectShimCrypto(config)
	interposeDaemonKBPKI(config, "alice", "bob", "charlie")
	ctx = context.Background()

	// Don't test implicit teams.
	config.mockKbpki.EXPECT().ResolveImplicitTeam(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		AnyTimes().Return(idutil.ImplicitTeamInfo{}, errors.New("No such team"))
	// Don't cache IDs.
	config.mockMdcache.EXPECT().GetIDForHandle(gomock.Any()).AnyTimes().
		Return(tlf.NullID, NoSuchTlfIDError{nil})
	config.mockMdcache.EXPECT().PutIDForHandle(gomock.Any(), gomock.Any()).
		AnyTimes().Return(nil)
	mockNormalizeSocialAssertion(config)

	return mockCtrl, config, ctx
}

func mdOpsShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func addPrivateDataToRMD(t *testing.T,
	codec kbfscodec.Codec, rmd *RootMetadata, h *tlfhandle.Handle,
	pmd PrivateMetadata) {
	rmd.SetRevision(kbfsmd.Revision(1))
	// TODO: Will have to change this for private folders if we
	// un-mock out those tests.
	buf, err := codec.Encode(pmd)
	require.NoError(t, err)
	rmd.SetSerializedPrivateMetadata(buf)
	rmd.SetLastModifyingWriter(h.FirstResolvedWriter().AsUserOrBust())
	rmd.SetLastModifyingUser(h.FirstResolvedWriter().AsUserOrBust())
	if h.Type() == tlf.Private {
		rmd.fakeInitialRekey()
	}
}

func addFakeRMDData(t *testing.T,
	codec kbfscodec.Codec, rmd *RootMetadata, h *tlfhandle.Handle) {
	addPrivateDataToRMD(t, codec, rmd, h, PrivateMetadata{})
}

func newRMDS(t *testing.T, config Config, h *tlfhandle.Handle) (
	*RootMetadataSigned, kbfsmd.ExtraMetadata) {
	id := h.TlfID()
	if id == tlf.NullID {
		id = tlf.FakeID(1, h.Type())
	}

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)

	addFakeRMDData(t, config.Codec(), rmd, h)
	ctx := context.Background()

	// Encode and sign writer metadata.
	err = rmd.bareMd.SignWriterMetadataInternally(ctx, config.Codec(), config.Crypto())
	require.NoError(t, err)

	rmds, err := SignBareRootMetadata(
		ctx, config.Codec(), config.Crypto(), config.Crypto(),
		rmd.bareMd, time.Now())
	require.NoError(t, err)
	return rmds, rmd.extra
}

func verifyMDForPublic(config *ConfigMock, rmds *RootMetadataSigned,
	hasVerifyingKeyErr error) {
	config.mockKbpki.EXPECT().HasVerifyingKey(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		AnyTimes().Return(hasVerifyingKeyErr)
	if hasVerifyingKeyErr == nil {
		config.mockMdcache.EXPECT().Put(gomock.Any())
	}
}

// kmdMatcher implements the gomock.Matcher interface to compare
// KeyMetadata objects.
type kmdMatcher struct {
	kmd libkey.KeyMetadata
}

func (m kmdMatcher) Matches(x interface{}) bool {
	kmd, ok := x.(libkey.KeyMetadata)
	if !ok {
		return false
	}
	return (m.kmd.TlfID() == kmd.TlfID()) &&
		(m.kmd.LatestKeyGeneration() == kmd.LatestKeyGeneration())
}

func (m kmdMatcher) String() string {
	return fmt.Sprintf("Matches KeyMetadata with TlfID=%s and key generation %d",
		m.kmd.TlfID(), m.kmd.LatestKeyGeneration())
}

func expectGetTLFCryptKeyForEncryption(config *ConfigMock, kmd libkey.KeyMetadata) {
	config.mockKeyman.EXPECT().GetTLFCryptKeyForEncryption(gomock.Any(),
		kmdMatcher{kmd}).Return(kbfscrypto.TLFCryptKey{}, nil)
}

func expectGetTLFCryptKeyForMDDecryptionAtMostOnce(config *ConfigMock,
	kmd libkey.KeyMetadata) {
	config.mockKeyman.EXPECT().GetTLFCryptKeyForMDDecryption(gomock.Any(),
		kmdMatcher{kmd}, kmdMatcher{kmd}).MaxTimes(1).Return(
		kbfscrypto.TLFCryptKey{}, nil)
}

func verifyMDForPrivateHelper(
	config *ConfigMock, rmds *RootMetadataSigned, minTimes, maxTimes int,
	forceFinal bool) {
	mdCopy, err := rmds.MD.DeepCopy(config.Codec())
	if err != nil {
		panic(err)
	}
	fakeRMD := RootMetadata{
		bareMd: mdCopy,
	}
	expectGetTLFCryptKeyForMDDecryptionAtMostOnce(config, &fakeRMD)
	var pmd PrivateMetadata
	config.mockCrypto.EXPECT().DecryptPrivateMetadata(
		gomock.Any(), kbfscrypto.TLFCryptKey{}).
		MinTimes(minTimes).MaxTimes(maxTimes).Return(pmd, nil)

	config.mockKbpki.EXPECT().HasVerifyingKey(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		AnyTimes().Return(nil)
	config.mockMdcache.EXPECT().Put(gomock.Any()).AnyTimes()
	config.mockKeyman.EXPECT().GetFirstTLFCryptKey(gomock.Any(), gomock.Any()).
		AnyTimes().Return(kbfscrypto.TLFCryptKey{}, nil)
}

func verifyMDForPrivate(
	config *ConfigMock, rmds *RootMetadataSigned) {
	verifyMDForPrivateHelper(config, rmds, 1, 1, false)
}

func putMDForPrivate(config *ConfigMock, rmd *RootMetadata) {
	expectGetTLFCryptKeyForEncryption(config, rmd)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		rmd.data, kbfscrypto.TLFCryptKey{}).Return(
		kbfscrypto.EncryptedPrivateMetadata{}, nil)
	config.mockBsplit.EXPECT().ShouldEmbedData(gomock.Any()).Return(true)
	config.mockMdserv.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(),
		nil, gomock.Any()).Return(nil)
	config.mockMdcache.EXPECT().Replace(gomock.Any(), gomock.Any())
}

func testMDOpsGetIDForHandlePublicSuccess(
	t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Public)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Public, id)
	rmds, _ := newRMDS(t, config, h)
	h.SetTlfID(tlf.NullID)

	verifyMDForPublic(config, rmds, nil)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(id, rmds, nil)

	id2, err := config.MDOps().GetIDForHandle(ctx, h)
	require.NoError(t, err)
	require.Equal(t, id, id2)
}

func expectGetKeyBundles(ctx context.Context, config *ConfigMock, extra kbfsmd.ExtraMetadata) {
	if extraV3, ok := extra.(*kbfsmd.ExtraMetadataV3); ok {
		wkb := extraV3.GetWriterKeyBundle()
		rkb := extraV3.GetReaderKeyBundle()
		config.mockMdserv.EXPECT().GetKeyBundles(
			ctx, gomock.Any(), gomock.Any(), gomock.Any()).
			Return(&wkb, &rkb, nil)
	}
}

func testMDOpsGetIDForHandlePrivateSuccess(
	t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	rmds, extra := newRMDS(t, config, h)
	h.SetTlfID(tlf.NullID)

	verifyMDForPrivate(config, rmds)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(id, rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	id2, err := config.MDOps().GetIDForHandle(ctx, h)
	require.NoError(t, err)
	require.Equal(t, id, id2)
}

func testMDOpsGetIDForUnresolvedHandlePublicSuccess(
	t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Public)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Public, id)
	rmds, _ := newRMDS(t, config, h)
	h.SetTlfID(tlf.NullID)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, nil)

	hUnresolved, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), tlfhandle.ConstIDGetter{ID: id}, nil,
		"alice,bob@twitter", tlf.Public)
	require.NoError(t, err)
	hUnresolved.SetTlfID(tlf.NullID)

	config.mockMdserv.EXPECT().GetForHandle(ctx,
		hUnresolved.ToBareHandleOrBust(), kbfsmd.Merged, nil).Return(
		id, rmds, nil).Times(2)

	// First time should fail.
	_, err = config.MDOps().GetIDForHandle(ctx, hUnresolved)
	if _, ok := err.(tlfhandle.HandleMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	daemon.AddNewAssertionForTestOrBust("bob", "bob@twitter")

	// Second time should succeed.
	if _, err := config.MDOps().GetIDForHandle(ctx, hUnresolved); err != nil {
		t.Errorf("Got error on get: %v", err)
	}
}

func testMDOpsGetIDForUnresolvedMdHandlePublicSuccess(
	t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Public)
	mdHandle1, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), tlfhandle.ConstIDGetter{ID: id}, nil,
		"alice,dave@twitter", tlf.Public)
	require.NoError(t, err)
	mdHandle1.SetTlfID(tlf.NullID)

	mdHandle2, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), tlfhandle.ConstIDGetter{ID: id}, nil,
		"alice,bob,charlie", tlf.Public)
	require.NoError(t, err)
	mdHandle2.SetTlfID(tlf.NullID)

	mdHandle3, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), tlfhandle.ConstIDGetter{ID: id}, nil,
		"alice,bob@twitter,charlie@twitter", tlf.Public)
	require.NoError(t, err)
	mdHandle3.SetTlfID(tlf.NullID)

	rmds1, _ := newRMDS(t, config, mdHandle1)

	rmds2, _ := newRMDS(t, config, mdHandle2)

	rmds3, _ := newRMDS(t, config, mdHandle3)

	// Do this before setting tlfHandles to nil.
	verifyMDForPublic(config, rmds2, nil)
	verifyMDForPublic(config, rmds3, nil)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), tlfhandle.ConstIDGetter{ID: id}, nil,
		"alice,bob,charlie@twitter", tlf.Public)
	require.NoError(t, err)
	h.SetTlfID(tlf.NullID)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(id, rmds1, nil)

	// First time should fail.
	_, err = config.MDOps().GetIDForHandle(ctx, h)
	if _, ok := err.(tlfhandle.HandleMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	daemon.AddNewAssertionForTestOrBust("bob", "bob@twitter")
	daemon.AddNewAssertionForTestOrBust("charlie", "charlie@twitter")

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(id, rmds2, nil)

	// Second time should succeed.
	if _, err := config.MDOps().GetIDForHandle(ctx, h); err != nil {
		t.Errorf("Got error on get: %v", err)
	}

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(id, rmds3, nil)

	if _, err := config.MDOps().GetIDForHandle(ctx, h); err != nil {
		t.Errorf("Got error on get: %v", err)
	}
}

func testMDOpsGetIDForUnresolvedHandlePublicFailure(
	t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Public)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Public, id)
	rmds, _ := newRMDS(t, config, h)

	hUnresolved, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), tlfhandle.ConstIDGetter{ID: id}, nil,
		"alice,bob@github,bob@twitter", tlf.Public)
	require.NoError(t, err)
	hUnresolved.SetTlfID(tlf.NullID)

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	daemon.AddNewAssertionForTestOrBust("bob", "bob@twitter")

	config.mockMdserv.EXPECT().GetForHandle(ctx,
		hUnresolved.ToBareHandleOrBust(), kbfsmd.Merged, nil).Return(
		id, rmds, nil)

	// Should still fail.
	_, err = config.MDOps().GetIDForHandle(ctx, hUnresolved)
	if _, ok := err.(tlfhandle.HandleMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func testMDOpsGetIDForHandlePublicFailFindKey(
	t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Public)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Public, id)
	rmds, _ := newRMDS(t, config, h)
	h.SetTlfID(tlf.NullID)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, VerifyingKeyNotFoundError{})

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(id, rmds, nil)

	_, err := config.MDOps().GetIDForHandle(ctx, h)
	if _, ok := err.(UnverifiableTlfUpdateError); !ok {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func testMDOpsGetIDForHandlePublicFailVerify(
	t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Public)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Public, id)
	rmds, _ := newRMDS(t, config, h)
	h.SetTlfID(tlf.NullID)

	// Change something in rmds that affects the computed MdID,
	// which will then cause an MDMismatchError.
	rmds.MD.(kbfsmd.MutableRootMetadata).SetRefBytes(100)
	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(id, rmds, nil)

	_, err := config.MDOps().GetIDForHandle(ctx, h)
	require.IsType(t, MDMismatchError{}, err)
}

func testMDOpsGetIDForHandleFailGet(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	h.SetTlfID(tlf.NullID)

	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(tlf.NullID, nil, err)

	if _, err2 := config.MDOps().GetIDForHandle(ctx, h); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func testMDOpsGetIDForHandleFailHandleCheck(
	t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	rmds, extra := newRMDS(t, config, h)
	h.SetTlfID(tlf.NullID)

	// Make a different handle.
	otherH := parseTlfHandleOrBust(t, config, "alice", tlf.Private, id)
	otherH.SetTlfID(tlf.NullID)
	config.mockMdserv.EXPECT().GetForHandle(ctx, otherH.ToBareHandleOrBust(),
		kbfsmd.Merged, nil).Return(id, rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	_, err := config.MDOps().GetIDForHandle(ctx, otherH)
	if _, ok := err.(tlfhandle.HandleMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func testMDOpsGetSuccess(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	rmds, extra := newRMDS(t, config, h)

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds)

	config.mockMdserv.EXPECT().GetForTLF(ctx, rmds.MD.TlfID(), kbfsmd.NullBranchID,
		kbfsmd.Merged, nil).Return(rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	// Do this first, since rmds is consumed.
	expectedMD := rmds.MD
	rmd2, err := config.MDOps().GetForTLF(ctx, rmds.MD.TlfID(), nil)
	require.NoError(t, err)
	require.Equal(t, expectedMD, rmd2.bareMd)
}

func testMDOpsGetBlankSigFailure(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	rmds, extra := newRMDS(t, config, h)
	rmds.SigInfo = kbfscrypto.SignatureInfo{}

	verifyMDForPrivate(config, rmds)
	config.mockMdserv.EXPECT().GetForTLF(ctx, rmds.MD.TlfID(), kbfsmd.NullBranchID,
		kbfsmd.Merged, nil).Return(rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	if _, err := config.MDOps().GetForTLF(ctx, rmds.MD.TlfID(), nil); err == nil {
		t.Error("Got no error on get")
	}
}

func testMDOpsGetFailGet(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Public)
	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForTLF(ctx, id, kbfsmd.NullBranchID,
		kbfsmd.Merged, nil).Return(nil, err)

	if _, err2 := config.MDOps().GetForTLF(ctx, id, nil); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func testMDOpsGetFailIDCheck(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	rmds, extra := newRMDS(t, config, h)

	id2 := tlf.FakeID(2, tlf.Public)

	config.mockMdserv.EXPECT().GetForTLF(ctx, id2, kbfsmd.NullBranchID,
		kbfsmd.Merged, nil).Return(rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	if _, err := config.MDOps().GetForTLF(ctx, id2, nil); err == nil {
		t.Errorf("Got no error on bad id check test")
	}
}

func makeRMDSRange(t *testing.T, config Config,
	start kbfsmd.Revision, count int, prevID kbfsmd.ID) (
	rmdses []*RootMetadataSigned, extras []kbfsmd.ExtraMetadata) {
	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	for i := 0; i < count; i++ {
		rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
		if err != nil {
			t.Fatal(err)
		}

		addFakeRMDData(t, config.Codec(), rmd, h)
		rmd.SetPrevRoot(prevID)
		rmd.SetRevision(start + kbfsmd.Revision(i))

		ctx := context.Background()

		// Encode and sign writer metadata.
		err = rmd.bareMd.SignWriterMetadataInternally(ctx, config.Codec(), config.Crypto())
		require.NoError(t, err)

		rmds, err := SignBareRootMetadata(
			ctx, config.Codec(), config.Crypto(), config.Crypto(),
			rmd.bareMd, time.Now())
		require.NoError(t, err)
		currID, err := kbfsmd.MakeID(config.Codec(), rmds.MD)
		require.NoError(t, err)
		prevID = currID
		rmdses = append(rmdses, rmds)
		extras = append(extras, rmd.extra)
	}
	return rmdses, extras
}

type keyBundleMDServer struct {
	MDServer
	nextHead     *RootMetadataSigned
	nextGetRange []*RootMetadataSigned

	nextMerkleRoot      *kbfsmd.MerkleRoot
	nextMerkleNodes     [][]byte
	nextMerkleRootSeqno keybase1.Seqno

	lock sync.RWMutex
	wkbs map[kbfsmd.TLFWriterKeyBundleID]kbfsmd.TLFWriterKeyBundleV3
	rkbs map[kbfsmd.TLFReaderKeyBundleID]kbfsmd.TLFReaderKeyBundleV3
}

func makeKeyBundleMDServer(mdServer MDServer) *keyBundleMDServer {
	return &keyBundleMDServer{
		MDServer: mdServer,
		wkbs:     make(map[kbfsmd.TLFWriterKeyBundleID]kbfsmd.TLFWriterKeyBundleV3),
		rkbs:     make(map[kbfsmd.TLFReaderKeyBundleID]kbfsmd.TLFReaderKeyBundleV3),
	}
}

func (mds *keyBundleMDServer) putWKB(
	id kbfsmd.TLFWriterKeyBundleID, wkb kbfsmd.TLFWriterKeyBundleV3) {
	mds.lock.Lock()
	defer mds.lock.Unlock()
	mds.wkbs[id] = wkb
}

func (mds *keyBundleMDServer) putRKB(
	id kbfsmd.TLFReaderKeyBundleID, rkb kbfsmd.TLFReaderKeyBundleV3) {
	mds.lock.Lock()
	defer mds.lock.Unlock()
	mds.rkbs[id] = rkb
}

func (mds *keyBundleMDServer) processRMDSes(
	rmds *RootMetadataSigned, extra kbfsmd.ExtraMetadata) {
	if extraV3, ok := extra.(*kbfsmd.ExtraMetadataV3); ok {
		mds.putWKB(rmds.MD.GetTLFWriterKeyBundleID(), extraV3.GetWriterKeyBundle())
		mds.putRKB(rmds.MD.GetTLFReaderKeyBundleID(), extraV3.GetReaderKeyBundle())
	}
}

func (mds *keyBundleMDServer) GetForTLF(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, _ *keybase1.LockID) (
	*RootMetadataSigned, error) {
	rmd := mds.nextHead
	mds.nextHead = nil
	return rmd, nil
}

func (mds *keyBundleMDServer) GetRange(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, start, stop kbfsmd.Revision,
	_ *keybase1.LockID) ([]*RootMetadataSigned, error) {
	rmdses := mds.nextGetRange
	mds.nextGetRange = nil
	return rmdses, nil
}

func (mds *keyBundleMDServer) GetKeyBundles(ctx context.Context, tlfID tlf.ID,
	wkbID kbfsmd.TLFWriterKeyBundleID, rkbID kbfsmd.TLFReaderKeyBundleID) (
	*kbfsmd.TLFWriterKeyBundleV3, *kbfsmd.TLFReaderKeyBundleV3, error) {
	mds.lock.RLock()
	defer mds.lock.RUnlock()
	wkb := mds.wkbs[wkbID]
	rkb := mds.rkbs[rkbID]
	return &wkb, &rkb, nil
}

func (mds *keyBundleMDServer) FindNextMD(
	ctx context.Context, tlfID tlf.ID, rootSeqno keybase1.Seqno) (
	nextKbfsRoot *kbfsmd.MerkleRoot, nextMerkleNodes [][]byte,
	nextRootSeqno keybase1.Seqno, err error) {
	nextKbfsRoot = mds.nextMerkleRoot
	nextMerkleNodes = mds.nextMerkleNodes
	nextRootSeqno = mds.nextMerkleRootSeqno

	mds.nextMerkleRoot = nil
	mds.nextMerkleNodes = nil
	mds.nextMerkleRootSeqno = 0
	return nextKbfsRoot, nextMerkleNodes, nextRootSeqno, nil
}

func testMDOpsGetRangeSuccessHelper(
	t *testing.T, ver kbfsmd.MetadataVer, fromStart bool) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, kbfsmd.FakeID(1))

	start := kbfsmd.Revision(100)
	stop := start + kbfsmd.Revision(len(rmdses))
	if fromStart {
		start = 0
	}

	for _, rmds := range rmdses {
		verifyMDForPrivate(config, rmds)
	}

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)

	mdServer.nextGetRange = rmdses
	for i, e := range extras {
		mdServer.processRMDSes(rmdses[i], e)
	}

	// Do this first since rmdses is consumed.
	expectedMDs := make([]kbfsmd.RootMetadata, len(rmdses))
	for i, rmds := range rmdses {
		expectedMDs[i] = rmds.MD
	}
	rmds, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop, nil)
	require.NoError(t, err)
	require.Equal(t, len(rmdses), len(rmds))
	for i := 0; i < len(rmdses); i++ {
		require.Equal(t, expectedMDs[i], rmds[i].bareMd)
	}
}

func testMDOpsGetRangeSuccess(t *testing.T, ver kbfsmd.MetadataVer) {
	testMDOpsGetRangeSuccessHelper(t, ver, false)
}

func testMDOpsGetRangeFromStartSuccess(t *testing.T, ver kbfsmd.MetadataVer) {
	testMDOpsGetRangeSuccessHelper(t, ver, true)
}

func testMDOpsGetRangeFailBadPrevRoot(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, kbfsmd.FakeID(1))

	rmdses[2].MD.(kbfsmd.MutableRootMetadata).SetPrevRoot(kbfsmd.FakeID(1))

	start := kbfsmd.Revision(100)
	stop := start + kbfsmd.Revision(len(rmdses))

	// Verification is parallelized, so we have to expect at most one
	// verification for each rmds.
	for _, rmds := range rmdses {
		verifyMDForPrivateHelper(config, rmds, 0, 1, false)
	}

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)

	mdServer.nextGetRange = rmdses
	for i, e := range extras {
		mdServer.processRMDSes(rmdses[i], e)
	}

	_, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop, nil)
	require.IsType(t, MDMismatchError{}, err)
}

type fakeMDServerPut struct {
	MDServer

	lastRmdsLock sync.Mutex
	lastRmds     *RootMetadataSigned
}

func (s *fakeMDServerPut) Put(ctx context.Context, rmds *RootMetadataSigned,
	_ kbfsmd.ExtraMetadata, _ *keybase1.LockContext, _ keybase1.MDPriority) error {
	s.lastRmdsLock.Lock()
	defer s.lastRmdsLock.Unlock()
	s.lastRmds = rmds
	return nil
}

func (s *fakeMDServerPut) getLastRmds() *RootMetadataSigned {
	s.lastRmdsLock.Lock()
	defer s.lastRmdsLock.Unlock()
	return s.lastRmds
}

func (s *fakeMDServerPut) Shutdown() {}

func validatePutPublicRMDS(
	ctx context.Context, t *testing.T, ver kbfsmd.MetadataVer, config Config,
	inputRmd kbfsmd.RootMetadata, rmds *RootMetadataSigned) {
	// TODO: Handle private RMDS, too.

	// Verify LastModifying* fields.
	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	require.Equal(t, session.UID, rmds.MD.LastModifyingWriter())
	require.Equal(t, session.UID, rmds.MD.GetLastModifyingUser())

	// Verify signature of WriterMetadata.
	buf, err := rmds.MD.GetSerializedWriterMetadata(config.Codec())
	require.NoError(t, err)
	err = kbfscrypto.Verify(buf, rmds.GetWriterMetadataSigInfo())
	require.NoError(t, err)

	// Verify encoded PrivateMetadata.
	var data PrivateMetadata
	err = config.Codec().Decode(rmds.MD.GetSerializedPrivateMetadata(), &data)
	require.NoError(t, err)

	// Verify signature of RootMetadata.
	buf, err = config.Codec().Encode(rmds.MD)
	require.NoError(t, err)
	err = kbfscrypto.Verify(buf, rmds.SigInfo)
	require.NoError(t, err)

	expectedRmd, err := inputRmd.DeepCopy(config.Codec())
	require.NoError(t, err)

	// Overwrite written fields.
	expectedRmd.SetLastModifyingWriter(rmds.MD.LastModifyingWriter())
	expectedRmd.SetLastModifyingUser(rmds.MD.GetLastModifyingUser())
	if ver < kbfsmd.SegregatedKeyBundlesVer {
		expectedRmd.(*kbfsmd.RootMetadataV2).WriterMetadataSigInfo =
			rmds.MD.(*kbfsmd.RootMetadataV2).WriterMetadataSigInfo
	}
	expectedRmd.SetSerializedPrivateMetadata(rmds.MD.GetSerializedPrivateMetadata())

	require.Equal(t, expectedRmd, rmds.MD)
}

func testMDOpsPutPublicSuccess(t *testing.T, ver kbfsmd.MetadataVer) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice", "bob")
	config.SetMetadataVersion(ver)
	defer CheckConfigAndShutdown(ctx, t, config)

	config.MDServer().Shutdown()
	var mdServer fakeMDServerPut
	config.SetMDServer(&mdServer)

	id := tlf.FakeID(1, tlf.Public)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Public, id)

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	rmd.data = makeFakePrivateMetadataFuture(t).toCurrent()
	rmd.tlfHandle = h

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	_, err = config.MDOps().Put(
		ctx, rmd, session.VerifyingKey, nil, keybase1.MDPriorityNormal, nil)
	require.NoError(t, err)

	rmds := mdServer.getLastRmds()
	validatePutPublicRMDS(ctx, t, ver, config, rmd.bareMd, rmds)
}

func testMDOpsPutPrivateSuccess(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	config.SetCodec(kbfscodec.NewMsgpack())

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	addFakeRMDData(t, config.Codec(), rmd, h)

	putMDForPrivate(config, rmd)

	key := kbfscrypto.MakeFakeVerifyingKeyOrBust("test key")
	if _, err := config.MDOps().Put(
		ctx, rmd, key, nil, keybase1.MDPriorityNormal, nil); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

type failEncodeCodec struct {
	kbfscodec.Codec
	err error
}

func (c failEncodeCodec) Encode(obj interface{}) ([]byte, error) {
	return nil, c.err
}

func testMDOpsPutFailEncode(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)

	expectGetTLFCryptKeyForEncryption(config, rmd)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		rmd.data, kbfscrypto.TLFCryptKey{}).Return(
		kbfscrypto.EncryptedPrivateMetadata{}, nil)
	config.mockBsplit.EXPECT().ShouldEmbedData(gomock.Any()).Return(true)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	err = errors.New("Fake fail")
	config.SetCodec(failEncodeCodec{config.Codec(), err})

	if _, err2 := config.MDOps().Put(
		ctx, rmd, session.VerifyingKey, nil, keybase1.MDPriorityNormal,
		nil); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func testMDOpsGetRangeFailFinal(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, kbfsmd.FakeID(1))
	rmdses[2].MD.(kbfsmd.MutableRootMetadata).SetFinalBit()
	rmdses[2].MD.(kbfsmd.MutableRootMetadata).SetPrevRoot(rmdses[1].MD.GetPrevRoot())

	start := kbfsmd.Revision(100)
	stop := start + kbfsmd.Revision(len(rmdses))

	// Verification is parallelized, so we have to expect at most one
	// verification for each rmds.
	for _, rmds := range rmdses {
		verifyMDForPrivateHelper(config, rmds, 0, 1, false)
	}

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)

	mdServer.nextGetRange = rmdses
	for i, e := range extras {
		mdServer.processRMDSes(rmdses[i], e)
	}
	_, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop, nil)
	require.IsType(t, MDMismatchError{}, err)
}

func testMDOpsGetFinalSuccess(t *testing.T, ver kbfsmd.MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(
		t, config, kbfsmd.RevisionInitial, 5, kbfsmd.ID{})

	now := time.Now()
	finalizedInfo, err := tlf.NewHandleExtension(
		tlf.HandleExtensionFinalized, 1, kbname.NormalizedUsername("<unknown>"),
		now)
	require.NoError(t, err)
	finalRMDS, err := rmdses[len(rmdses)-1].MakeFinalCopy(
		config.Codec(), now, finalizedInfo)
	require.NoError(t, err)
	verifyMDForPrivateHelper(config, finalRMDS, 1, 1, false)

	config.SetMDCache(NewMDCacheStandard(10))
	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)

	// A finalized head will force MDOps to fetch the preceding MD, in
	// order to check the authenticity of the copied writer MD.
	// However the key that signed that MD could be a pre-reset key,
	// so we need to make calls to get unverified keys.
	mdServer.nextHead = finalRMDS
	lastRMDRange := rmdses[len(rmdses)-1:]
	mdServer.nextGetRange = lastRMDRange
	for i, e := range extras {
		mdServer.processRMDSes(rmdses[i], e)
	}

	verifyMDForPrivateHelper(config, lastRMDRange[0], 1, 1, true)

	_, err = config.MDOps().GetForTLF(ctx, finalRMDS.MD.TlfID(), nil)
	require.NoError(t, err)
}

func makeRealInitialRMDForTesting(
	ctx context.Context, t *testing.T, config Config, h *tlfhandle.Handle,
	id tlf.ID) (*RootMetadata, *RootMetadataSigned) {
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	if h.TypeForKeying() == tlf.TeamKeying {
		rmd.bareMd.SetLatestKeyGenerationForTeamTLF(1)
	} else {
		rekeyDone, _, err := config.KeyManager().Rekey(ctx, rmd, false)
		require.NoError(t, err)
		require.True(t, rekeyDone)
	}
	_, _, _, err = ResetRootBlock(ctx, config, rmd)
	require.NoError(t, err)
	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	err = encryptMDPrivateData(
		ctx, config.Codec(), config.Crypto(),
		config.Crypto(), config.KeyManager(), session.UID, rmd)
	require.NoError(t, err)
	err = rmd.bareMd.SignWriterMetadataInternally(
		ctx, config.Codec(), config.Crypto())
	require.NoError(t, err)
	now := config.Clock().Now()
	rmds, err := SignBareRootMetadata(
		ctx, config.Codec(), config.Crypto(), config.Crypto(), rmd.bareMd, now)
	require.NoError(t, err)
	return rmd, rmds
}

func makeSuccessorRMDForTesting(
	ctx context.Context, t *testing.T, config Config, currRMD *RootMetadata,
	deviceToRevoke int) (
	*RootMetadata, *RootMetadataSigned) {
	mdID, err := kbfsmd.MakeID(config.Codec(), currRMD.bareMd)
	require.NoError(t, err)

	rmd, err := currRMD.MakeSuccessor(
		ctx, config.MetadataVersion(), config.Codec(), config.KeyManager(),
		config.KBPKI(), config.KBPKI(), config, mdID, true)
	require.NoError(t, err)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	if deviceToRevoke > 0 {
		RevokeDeviceForLocalUserOrBust(t, config, session.UID, deviceToRevoke)
		rekeyDone, _, err := config.KeyManager().Rekey(ctx, rmd, false)
		require.NoError(t, err)
		require.True(t, rekeyDone)
	}
	_, _, _, err = ResetRootBlock(ctx, config, rmd)
	require.NoError(t, err)
	err = encryptMDPrivateData(
		ctx, config.Codec(), config.Crypto(),
		config.Crypto(), config.KeyManager(), session.UID, rmd)
	require.NoError(t, err)

	err = rmd.bareMd.SignWriterMetadataInternally(
		ctx, config.Codec(), config.Crypto())
	require.NoError(t, err)
	now := config.Clock().Now()
	rmds, err := SignBareRootMetadata(
		ctx, config.Codec(), config.Crypto(), config.Crypto(),
		rmd.bareMd, now)
	require.NoError(t, err)
	return rmd, rmds
}

func makeEncryptedMerkleLeafForTesting(
	t *testing.T, config Config, rmd *RootMetadata) (
	root *kbfsmd.MerkleRoot, rootNodeBytes []byte,
	mLeaf kbfsmd.MerkleLeaf, leafBytes []byte) {
	ePubKey, ePrivKey, err := kbfscrypto.MakeRandomTLFEphemeralKeys()
	require.NoError(t, err)
	var nonce [24]byte
	_, err = rand.Read(nonce[:])
	require.NoError(t, err)
	now := config.Clock().Now().Unix()
	root = &kbfsmd.MerkleRoot{
		EPubKey:   &ePubKey,
		Nonce:     &nonce,
		Timestamp: now,
	}

	mLeaf = kbfsmd.MerkleLeaf{
		Revision:  1,
		Timestamp: now,
	}
	var pubKey kbfscrypto.TLFPublicKey
	if rmd.TypeForKeying() == tlf.TeamKeying {
		crypto, ok := config.Crypto().(*CryptoLocal)
		require.True(t, ok)
		tid := rmd.GetTlfHandle().FirstResolvedWriter().AsTeamOrBust()
		pubKey, err = crypto.pubKeyForTeamKeyGeneration(
			tid, keybase1.PerTeamKeyGeneration(rmd.LatestKeyGeneration()))
		require.NoError(t, err)
	} else {
		pubKey, err = rmd.bareMd.GetCurrentTLFPublicKey(rmd.extra)
		require.NoError(t, err)
	}
	eLeaf, err := mLeaf.Encrypt(config.Codec(), pubKey, &nonce, ePrivKey)
	require.NoError(t, err)
	leafBytes, err = config.Codec().Encode(eLeaf)
	require.NoError(t, err)

	rootNode := merkle.Node{
		Type: 2,
		Leafs: []merkle.KeyValuePair{{
			Key:   merkle.Hash(rmd.TlfID().Bytes()),
			Value: leafBytes,
		}},
	}
	rootNodeBytes, err = config.Codec().Encode(rootNode)
	require.NoError(t, err)
	hasher := merkle.SHA512Hasher{}
	root.Hash = hasher.Hash(rootNodeBytes)

	return root, rootNodeBytes, mLeaf, leafBytes
}

func testMDOpsDecryptMerkleLeafPrivate(t *testing.T, ver kbfsmd.MetadataVer) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)
	config.SetMetadataVersion(ver)

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	var extraDevice int
	for i := 0; i < 4; i++ {
		extraDevice = AddDeviceForLocalUserOrBust(t, config, session.UID)
	}

	t.Log("Making an initial RMD")
	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "u1", tlf.Private, id)
	rmd, rmds := makeRealInitialRMDForTesting(ctx, t, config, h, id)

	t.Log("Making an encrypted Merkle leaf")
	root, _, mLeaf, leafBytes := makeEncryptedMerkleLeafForTesting(
		t, config, rmd)

	mdServer.nextHead = rmds
	mdServer.processRMDSes(rmds, rmd.extra)

	t.Log("Try to decrypt with the right key")
	mdOps := config.MDOps().(*MDOpsStandard)
	mLeaf2, err := mdOps.decryptMerkleLeaf(ctx, rmd.ReadOnly(), root, leafBytes)
	require.NoError(t, err)
	require.Equal(t, mLeaf.Revision, mLeaf2.Revision)
	require.Equal(t, mLeaf.Timestamp, mLeaf2.Timestamp)

	// `rmds` gets destroyed by `MDOpsStandard.GetForTLF()`, so we
	// need to make another one.
	now := config.Clock().Now()
	rmds, err = SignBareRootMetadata(
		ctx, config.Codec(), config.Crypto(), config.Crypto(), rmd.bareMd, now)
	require.NoError(t, err)
	mdServer.nextHead = rmds

	t.Log("Try to decrypt with the wrong key; should fail")
	_, privKeyWrong, _, err := config.Crypto().MakeRandomTLFKeys()
	require.NoError(t, err)
	privKey := rmd.data.TLFPrivateKey
	rmd.data.TLFPrivateKey = privKeyWrong
	_, err = mdOps.decryptMerkleLeaf(ctx, rmd.ReadOnly(), root, leafBytes)
	require.Error(t, err)

	t.Log("Make some successors, every once in a while bumping the keygen")
	rmd.data.TLFPrivateKey = privKey
	allRMDs := []*RootMetadata{rmd}
	allRMDSs := []*RootMetadataSigned{rmds}
	for i := 2; i < 20; i++ {
		deviceToRevoke := -1
		if i%5 == 0 {
			deviceToRevoke = extraDevice
			extraDevice--
		}

		rmd, rmds = makeSuccessorRMDForTesting(
			ctx, t, config, rmd, deviceToRevoke)
		allRMDs = append(allRMDs, rmd)
		allRMDSs = append(allRMDSs, rmds)

		if i%5 == 0 {
			mdServer.processRMDSes(rmds, rmd.extra)
		}
	}

	t.Log("Decrypt a leaf that's encrypted with the next keygen")
	leafRMD := allRMDs[6]
	root, _, mLeaf, leafBytes = makeEncryptedMerkleLeafForTesting(
		t, config, leafRMD)
	rmds, err = SignBareRootMetadata(
		ctx, config.Codec(), config.Crypto(), config.Crypto(),
		rmd.bareMd, now)
	require.NoError(t, err)
	mdServer.nextHead = rmds
	mdServer.nextGetRange = allRMDSs[1:10]
	mLeaf2, err = mdOps.decryptMerkleLeaf(
		ctx, allRMDs[0].ReadOnly(), root, leafBytes)
	require.NoError(t, err)
	require.Equal(t, mLeaf.Revision, mLeaf2.Revision)
	require.Equal(t, mLeaf.Timestamp, mLeaf2.Timestamp)
}

func testMDOpsDecryptMerkleLeafTeam(t *testing.T, ver kbfsmd.MetadataVer) {
	if ver < kbfsmd.SegregatedKeyBundlesVer {
		t.Skip("Teams not supported")
	}

	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)
	config.SetMetadataVersion(ver)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	t.Log("Making an initial RMD")
	id := tlf.FakeID(1, tlf.SingleTeam)
	teamInfos := AddEmptyTeamsForTestOrBust(t, config, "t1")
	AddTeamWriterForTestOrBust(t, config, teamInfos[0].TID, session.UID)
	h := parseTlfHandleOrBust(t, config, "t1", tlf.SingleTeam, id)
	rmd, _ := makeRealInitialRMDForTesting(ctx, t, config, h, id)

	t.Log("Making an encrypted Merkle leaf")
	root, _, mLeaf, leafBytes := makeEncryptedMerkleLeafForTesting(
		t, config, rmd)

	t.Log("Try to decrypt with the right key")
	mdOps := config.MDOps().(*MDOpsStandard)
	mLeaf2, err := mdOps.decryptMerkleLeaf(ctx, rmd.ReadOnly(), root, leafBytes)
	require.NoError(t, err)
	require.Equal(t, mLeaf.Revision, mLeaf2.Revision)
	require.Equal(t, mLeaf.Timestamp, mLeaf2.Timestamp)

	// Error scenarios and multiple keygens are handled by the
	// service, and are not worth testing here.
}

func testMDOpsVerifyRevokedDeviceWrite(t *testing.T, ver kbfsmd.MetadataVer) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)
	config.SetMetadataVersion(ver)
	clock := clocktest.NewTestClockNow()
	config.SetClock(clock)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	config2 := ConfigAsUser(config, u1)
	defer CheckConfigAndShutdown(ctx, t, config2)
	AddDeviceForLocalUserOrBust(t, config, session.UID)
	extraDevice := AddDeviceForLocalUserOrBust(t, config2, session.UID)
	SwitchDeviceForLocalUserOrBust(t, config2, extraDevice)

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)
	config2.SetMDServer(mdServer)

	t.Log("Initial MD written by the device we will revoke")
	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "u1", tlf.Private, id)
	rmd, rmds := makeRealInitialRMDForTesting(ctx, t, config2, h, id)
	mdServer.processRMDSes(rmds, rmd.extra)

	t.Log("A few writes by a device that won't be revoked")
	allRMDs := []*RootMetadata{rmd}
	allRMDSs := []*RootMetadataSigned{rmds}
	for i := 2; i < 5; i++ {
		rmd, rmds = makeSuccessorRMDForTesting(ctx, t, config, rmd, -1)
		allRMDs = append(allRMDs, rmd)
		allRMDSs = append(allRMDSs, rmds)
	}

	t.Log("A write after the revoke happens")
	rmd, rmds = makeSuccessorRMDForTesting(ctx, t, config, rmd, extraDevice)
	allRMDs = append(allRMDs, rmd)
	allRMDSs = append(allRMDSs, rmds)
	mdServer.processRMDSes(rmds, rmd.extra)
	mdServer.nextHead = rmds
	mdServer.nextGetRange = allRMDSs[1 : len(allRMDSs)-1]

	t.Log("Make a merkle leaf using the new generation")
	clock.Add(1 * time.Second)
	root, rootNodeBytes, _, leafBytes := makeEncryptedMerkleLeafForTesting(
		t, config, rmd)
	mdServer.nextMerkleRoot = root
	mdServer.nextMerkleNodes = [][]byte{rootNodeBytes, leafBytes}
	mdServer.nextMerkleRootSeqno = 100

	irmd := MakeImmutableRootMetadata(
		allRMDs[0], allRMDSs[0].SigInfo.VerifyingKey, allRMDs[1].PrevRoot(),
		time.Now(), false)

	mdOps := config.MDOps().(*MDOpsStandard)
	cacheable, err := mdOps.verifyKey(
		ctx, allRMDSs[0], allRMDSs[0].MD.GetLastModifyingUser(),
		allRMDSs[0].SigInfo.VerifyingKey, irmd)
	require.NoError(t, err)
	require.True(t, cacheable)

	t.Log("Make the server return no information, but within the max gap")
	SetGlobalMerkleRootForTestOrBust(
		t, config, keybase1.MerkleRootV2{}, clock.Now())
	clock.Add(1 * time.Minute)
	mdServer.nextMerkleRoot = nil
	mdServer.nextMerkleNodes = nil
	mdServer.nextMerkleRootSeqno = 0
	mdLocal, ok := mdServer.MDServer.(mdServerLocal)
	require.True(t, ok)
	mdLocal.setKbfsMerkleRoot(keybase1.MerkleTreeID_KBFS_PRIVATE, root)
	cacheable, err = mdOps.verifyKey(
		ctx, allRMDSs[0], allRMDSs[0].MD.GetLastModifyingUser(),
		allRMDSs[0].SigInfo.VerifyingKey, irmd)
	require.NoError(t, err)
	require.True(t, cacheable)

	t.Log("Make the server return no information, but outside the max gap")
	config.MDCache().(*MDCacheStandard).nextMDLRU.Purge()
	clock.Add(maxAllowedMerkleGap) // already added one minute above
	_, err = mdOps.verifyKey(
		ctx, allRMDSs[0], allRMDSs[0].MD.GetLastModifyingUser(),
		allRMDSs[0].SigInfo.VerifyingKey, irmd)
	require.Error(t, err)

	t.Log("Make the server return a root, but which is outside the max gap")
	config.MDCache().(*MDCacheStandard).nextMDLRU.Purge()
	root.Timestamp = clock.Now().Unix()
	mdServer.nextMerkleRoot = root
	mdServer.nextMerkleNodes = [][]byte{leafBytes}
	mdServer.nextMerkleRootSeqno = 100
	_, err = mdOps.verifyKey(
		ctx, allRMDSs[0], allRMDSs[0].MD.GetLastModifyingUser(),
		allRMDSs[0].SigInfo.VerifyingKey, irmd)
	require.Error(t, err)
}

func testMDOpsVerifyRemovedUserWrite(t *testing.T, ver kbfsmd.MetadataVer) {
	if ver < kbfsmd.SegregatedKeyBundlesVer {
		t.Skip("Teams not supported")
	}

	var u1, u2 kbname.NormalizedUsername = "u1", "u2"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1, u2)
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)
	config.SetMetadataVersion(ver)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	config2 := ConfigAsUser(config, u2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)
	config2.SetMDServer(mdServer)

	t.Log("Initial MD written by the user we will remove")
	id := tlf.FakeID(1, tlf.SingleTeam)
	teamInfos := AddEmptyTeamsForTestOrBust(t, config, "t1")
	AddEmptyTeamsForTestOrBust(t, config2, "t1")
	tid := teamInfos[0].TID
	AddTeamWriterForTestOrBust(t, config, tid, session.UID)
	AddTeamWriterForTestOrBust(t, config2, tid, session.UID)
	AddTeamWriterForTestOrBust(t, config, tid, session2.UID)
	AddTeamWriterForTestOrBust(t, config2, tid, session2.UID)
	h := parseTlfHandleOrBust(t, config, "t1", tlf.SingleTeam, id)
	rmd, rmds := makeRealInitialRMDForTesting(ctx, t, config, h, id)
	mdServer.processRMDSes(rmds, rmd.extra)

	RemoveTeamWriterForTestOrBust(t, config, tid, session.UID)
	RemoveTeamWriterForTestOrBust(t, config2, tid, session.UID)

	t.Log("A few writes by a user that won't be removed")
	allRMDSs := []*RootMetadataSigned{rmds}
	for i := 2; i < 5; i++ {
		rmd, rmds = makeSuccessorRMDForTesting(ctx, t, config2, rmd, -1)
		allRMDSs = append(allRMDSs, rmds)
	}

	mdServer.processRMDSes(rmds, rmd.extra)
	mdServer.nextHead = rmds
	mdServer.nextGetRange = allRMDSs[1 : len(allRMDSs)-1]

	t.Log("Make a merkle leaf")
	root, rootNodeBytes, _, leafBytes := makeEncryptedMerkleLeafForTesting(
		t, config, rmd)
	mdServer.nextMerkleRoot = root
	mdServer.nextMerkleNodes = [][]byte{rootNodeBytes, leafBytes}
	mdServer.nextMerkleRootSeqno = 100

	mdOps := config.MDOps().(*MDOpsStandard)
	_, err = mdOps.processMetadata(ctx, h, allRMDSs[0], rmd.extra, nil)
	require.NoError(t, err)

	t.Log("Try another write by the removed user and make sure it fails")
	rmd, rmds = makeSuccessorRMDForTesting(ctx, t, config, rmd, -1)
	mdServer.processRMDSes(rmds, rmd.extra)
	mdServer.nextHead = rmds
	mdServer.nextGetRange = nil
	mdServer.nextMerkleRoot = root
	mdServer.nextMerkleNodes = [][]byte{rootNodeBytes, leafBytes}
	mdServer.nextMerkleRootSeqno = 100
	_, err = mdOps.processMetadata(ctx, h, rmds, rmd.extra, nil)
	require.Error(t, err)

}

func TestMDOps(t *testing.T) {
	tests := []func(*testing.T, kbfsmd.MetadataVer){
		testMDOpsGetIDForHandlePublicSuccess,
		testMDOpsGetIDForHandlePrivateSuccess,
		testMDOpsGetIDForUnresolvedHandlePublicSuccess,
		testMDOpsGetIDForUnresolvedMdHandlePublicSuccess,
		testMDOpsGetIDForUnresolvedHandlePublicFailure,
		testMDOpsGetIDForHandlePublicFailFindKey,
		testMDOpsGetIDForHandlePublicFailVerify,
		testMDOpsGetIDForHandleFailGet,
		testMDOpsGetIDForHandleFailHandleCheck,
		testMDOpsGetSuccess,
		testMDOpsGetBlankSigFailure,
		testMDOpsGetFailGet,
		testMDOpsGetFailIDCheck,
		testMDOpsGetRangeSuccess,
		testMDOpsGetRangeFromStartSuccess,
		testMDOpsGetRangeFailBadPrevRoot,
		testMDOpsPutPublicSuccess,
		testMDOpsPutPrivateSuccess,
		testMDOpsPutFailEncode,
		testMDOpsGetRangeFailFinal,
		testMDOpsGetFinalSuccess,
		testMDOpsDecryptMerkleLeafPrivate,
		testMDOpsDecryptMerkleLeafTeam,
		testMDOpsVerifyRevokedDeviceWrite,
		testMDOpsVerifyRemovedUserWrite,
	}
	runTestsOverMetadataVers(t, "testMDOps", tests)
}
