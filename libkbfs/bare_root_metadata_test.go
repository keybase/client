// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"reflect"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

var testMetadataVers = []MetadataVer{
	InitialExtraMetadataVer, SegregatedKeyBundlesVer,
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
// 	brmd, err := MakeInitialBareRootMetadata(ver, ...)
//	...
// }
func runTestOverMetadataVers(
	t *testing.T, f func(t *testing.T, ver MetadataVer)) {
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
// 	tests := []func(*testing.T, MetadataVer){
//		testFooBar1,
//		testFooBar2,
//		testFooBar3,
//		...
//	}
//	runTestsOverMetadataVers(t, "testFoo", tests)
// }
func runTestsOverMetadataVers(t *testing.T, prefix string,
	fs []func(t *testing.T, ver MetadataVer)) {
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
// func benchmarkFoo(b *testing.B, ver MetadataVer) {
//	...
// 	brmd, err := MakeInitialBareRootMetadata(ver, ...)
//	...
// }
func runBenchmarkOverMetadataVers(
	b *testing.B, f func(b *testing.B, ver MetadataVer)) {
	for _, ver := range testMetadataVers {
		ver := ver // capture range variable.
		b.Run(ver.String(), func(b *testing.B) {
			f(b, ver)
		})
	}
}

// TODO: Add way to test with all possible (ver, maxVer) combos,
// e.g. for upconversion tests.

// Test verification of finalized metadata blocks.
func TestRootMetadataFinalVerify(t *testing.T) {
	runTestOverMetadataVers(t, testRootMetadataFinalVerify)
}

func testRootMetadataFinalVerify(t *testing.T, ver MetadataVer) {
	tlfID := tlf.FakeID(1, tlf.Private)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	brmd, err := MakeInitialBareRootMetadata(ver, tlfID, bh)
	require.NoError(t, err)

	ctx := context.Background()
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(kbfscodec.NewMsgpack())
	signer := kbfscrypto.SigningKeySigner{
		Key: kbfscrypto.MakeFakeSigningKeyOrBust("key"),
	}

	extra := FakeInitialRekey(brmd, bh, kbfscrypto.TLFPublicKey{})

	brmd.SetLastModifyingWriter(uid)
	brmd.SetLastModifyingUser(uid)
	brmd.SetSerializedPrivateMetadata([]byte{42})
	err = brmd.SignWriterMetadataInternally(ctx, codec, signer)
	require.NoError(t, err)

	rmds, err := SignBareRootMetadata(
		ctx, codec, signer, signer, brmd, time.Time{})
	require.NoError(t, err)

	// verify it
	err = rmds.IsValidAndSigned(codec, crypto, extra)
	require.NoError(t, err)

	ext, err := tlf.NewHandleExtension(
		tlf.HandleExtensionFinalized, 1, "fake user", time.Now())
	require.NoError(t, err)

	// make a final copy
	rmds2, err := rmds.MakeFinalCopy(codec, time.Now(), ext)
	require.NoError(t, err)

	// verify the finalized copy
	err = rmds2.IsValidAndSigned(codec, crypto, extra)
	require.NoError(t, err)

	// touch something the server shouldn't be allowed to edit for
	// finalized metadata and verify verification failure.
	md3, err := rmds2.MD.DeepCopy(codec)
	require.NoError(t, err)
	md3.SetRekeyBit()
	rmds3 := rmds2
	rmds2.MD = md3
	err = rmds3.IsValidAndSigned(codec, crypto, extra)
	require.NotNil(t, err)
}
