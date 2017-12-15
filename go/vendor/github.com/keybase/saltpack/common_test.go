// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func TestComputePayloadAuthenticator(t *testing.T) {
	macKeys := []macKey{{0x01}, {0x02}}
	payloadHashes := []payloadHash{{0x03}, {0x04}}

	expectedAuthenticators := []payloadAuthenticator{
		{0xf, 0x2f, 0x81, 0xfb, 0xdb, 0x34, 0xc5, 0x61, 0x86, 0xfa, 0x72, 0x70, 0xd1, 0xd, 0xe5, 0x9f, 0x3d, 0x7e, 0x39, 0xcf, 0x9f, 0xa1, 0xf9, 0x9b, 0xc4, 0x38, 0x70, 0xa, 0x28, 0x5f, 0xeb, 0xd3},
		{0x2d, 0x7, 0x95, 0x64, 0xfa, 0xaf, 0xce, 0xde, 0x7a, 0x85, 0xea, 0xce, 0x78, 0xec, 0x71, 0xf, 0x84, 0x17, 0x9a, 0x32, 0x44, 0x2b, 0xb5, 0x4, 0xe9, 0x92, 0x28, 0x98, 0x4f, 0xfe, 0x9b, 0x5b},
		{0x16, 0xbd, 0xdb, 0xd, 0x5d, 0x71, 0xe2, 0xee, 0x58, 0x5a, 0x32, 0xcb, 0x27, 0xd4, 0x1e, 0x42, 0xff, 0xb5, 0xc3, 0x98, 0x81, 0x1c, 0xbd, 0x5e, 0x43, 0x9a, 0x4d, 0x55, 0xa7, 0xa5, 0xd1, 0x2b},
		{0x7c, 0xcd, 0x4f, 0xe3, 0xf5, 0xf6, 0x54, 0x7d, 0x65, 0x97, 0x90, 0x22, 0x9, 0xfb, 0x46, 0x69, 0xcd, 0x7a, 0x70, 0x9a, 0xa2, 0x5e, 0x1d, 0xa5, 0xe4, 0xc1, 0xf5, 0x14, 0x67, 0x55, 0xd4, 0xd8},
	}

	i := 0
	for _, macKey := range macKeys {
		for _, payloadHash := range payloadHashes {
			authenticator := computePayloadAuthenticator(macKey, payloadHash)
			if !authenticator.Equal(expectedAuthenticators[i]) {
				t.Errorf("Got %#v, expected %#v", authenticator, expectedAuthenticators[i])

			}
			i++
		}
	}
}

func runTestOverVersions(t *testing.T, f func(t *testing.T, version Version)) {
	for _, version := range KnownVersions() {
		version := version // capture range variable.
		t.Run(version.String(), func(t *testing.T) {
			f(t, version)
		})
	}
}

// runTestsOverVersions runs the given list of test functions over all
// versions to test. prefix should be the common prefix for all the
// test function names, and the names of the subtest will be taken to
// be the strings after that prefix. Example use:
//
// func TestFoo(t *testing.T) {
//      tests := []func(*testing.T, Version){
//              testFooBar1,
//              testFooBar2,
//              testFooBar3,
//              ...
//      }
//      runTestsOverVersions(t, "testFoo", tests)
// }
func runTestsOverVersions(t *testing.T, prefix string, fs []func(t *testing.T, ver Version)) {
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
			runTestOverVersions(t, f)
		})
	}
}

// Due to the specifics of Curve25519 (see https://cr.yp.to/ecdh.html ),
// the lower three bits of boxSecretKey.key[0] don't suffice to
// distinguish two secret keys.

var secret1 = boxSecretKey{
	key: RawBoxKey{0x08},
}
var secret2 = boxSecretKey{
	key: RawBoxKey{0x10},
}

var eSecret1 = boxSecretKey{
	key: RawBoxKey{0x18},
}
var eSecret2 = boxSecretKey{
	key: RawBoxKey{0x20},
}

var public1 = boxPublicKey{
	key: RawBoxKey{0x5},
}
var public2 = boxPublicKey{
	key: RawBoxKey{0x6},
}

var constHeaderHash = headerHash{0x7}

func TestComputeMACKeySenderV1(t *testing.T) {
	macKey1 := computeMACKeySender(Version1(), 0, secret1, eSecret1, public1, constHeaderHash)
	macKey2 := computeMACKeySender(Version1(), 1, secret1, eSecret1, public1, constHeaderHash)
	macKey3 := computeMACKeySender(Version1(), 0, secret2, eSecret1, public1, constHeaderHash)
	macKey4 := computeMACKeySender(Version1(), 0, secret1, eSecret2, public1, constHeaderHash)
	macKey5 := computeMACKeySender(Version1(), 0, secret1, eSecret1, public2, constHeaderHash)

	// The V1 MAC key doesn't depend on the index; this is fixed
	// in V2.
	if macKey2 != macKey1 {
		t.Errorf("macKey2 == %v != macKey1 == %v unexpectedly", macKey2, macKey1)
	}

	if macKey3 == macKey1 {
		t.Errorf("macKey3 == macKey1 == %v unexpectedly", macKey1)
	}

	// The V1 MAC key doesn't depend on the ephemeral keypair; this is
	// fixed in V2.
	if macKey4 != macKey1 {
		t.Errorf("macKey4 == %v != macKey1 == %v unexpectedly", macKey4, macKey1)
	}

	if macKey5 == macKey1 {
		t.Errorf("macKey5 == macKey1 == %v unexpectedly", macKey1)
	}
}

func TestComputeMACKeySenderV2(t *testing.T) {
	macKey1 := computeMACKeySender(Version2(), 0, secret1, eSecret1, public1, constHeaderHash)
	macKey2 := computeMACKeySender(Version2(), 1, secret1, eSecret1, public1, constHeaderHash)
	macKey3 := computeMACKeySender(Version2(), 0, secret2, eSecret1, public1, constHeaderHash)
	macKey4 := computeMACKeySender(Version2(), 0, secret1, eSecret2, public1, constHeaderHash)
	macKey5 := computeMACKeySender(Version2(), 0, secret1, eSecret1, public2, constHeaderHash)

	if macKey2 == macKey1 {
		t.Errorf("macKey2 == macKey1 == %v unexpectedly", macKey1)
	}

	if macKey3 == macKey1 {
		t.Errorf("macKey3 == macKey1 == %v unexpectedly", macKey1)
	}

	if macKey4 == macKey1 {
		t.Errorf("macKey4 == macKey1 == %v unexpectedly", macKey1)
	}

	if macKey5 == macKey1 {
		t.Errorf("macKey5 == macKey1 == %v unexpectedly", macKey1)
	}
}

func TestComputeMACKeySendersSameRecipientV1(t *testing.T) {
	receivers := []BoxPublicKey{public1, public1}
	macKeys := computeMACKeysSender(Version1(), secret1, eSecret1, receivers, constHeaderHash)

	if len(macKeys) != 2 {
		t.Fatalf("len(macKeys)=%d != 2 unexpectedly", len(macKeys))
	}

	// Identical recipients lead to identical MAC keys in V1; this
	// is fixed in V2.
	if macKeys[0] != macKeys[1] {
		t.Errorf("macKeys[0] = %v != macKeys[1] = %v unexpectedly", macKeys[0], macKeys[1])
	}
}

func TestComputeMACKeySendersSameRecipientV2(t *testing.T) {
	receivers := []BoxPublicKey{public1, public1}
	macKeys := computeMACKeysSender(Version2(), secret1, eSecret1, receivers, constHeaderHash)

	if len(macKeys) != 2 {
		t.Fatalf("len(macKeys)=%d != 2 unexpectedly", len(macKeys))
	}

	if macKeys[0] == macKeys[1] {
		t.Errorf("macKeys[0] == macKeys[1] = %v unexpectedly", macKeys[0])
	}
}

func testComputeMACKeySenderReceiver(t *testing.T, version Version) {
	var index uint64 = 3
	senderKey := newBoxKeyNoInsert(t)
	eKey := newBoxKeyNoInsert(t)
	receiverKey := newBoxKeyNoInsert(t)

	senderMACKey := computeMACKeySender(version, index, senderKey, eKey, receiverKey.GetPublicKey(), constHeaderHash)
	receiverMACKey := computeMACKeyReceiver(version, index, receiverKey, senderKey.GetPublicKey(), eKey.GetPublicKey(), constHeaderHash)
	if senderMACKey != receiverMACKey {
		t.Fatalf("senderMACKey = %v != receiverMACKey = %v", senderMACKey, receiverMACKey)
	}
}

func TestCommon(t *testing.T) {
	tests := []func(*testing.T, Version){
		testComputeMACKeySenderReceiver,
	}
	runTestsOverVersions(t, "test", tests)
}
