// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type kidContainerType interface {
	makeZero() interface{}
	makeFromKID(kid keybase1.KID) interface{}
	decode(codec *kbfscodec.CodecMsgpack, data []byte) (interface{}, error)
}

// Make sure the kid container type encodes and decodes properly with
// minimal overhead.
func testKidContainerTypeEncodeDecode(t *testing.T, kt kidContainerType) {
	codec := kbfscodec.NewMsgpack()
	kidBytes := []byte{1}
	k := kt.makeFromKID(keybase1.KIDFromSlice(kidBytes))

	encodedK, err := codec.Encode(k)
	require.NoError(t, err)

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	assert.Equal(t, len(kidBytes)+overhead, len(encodedK))

	k2, err := kt.decode(codec, encodedK)
	require.NoError(t, err)

	assert.Equal(t, k, k2)
}

// Make sure the zero value for the kid container type encodes and
// decodes properly.
func testKidContainerTypeEncodeDecodeZero(t *testing.T, kt kidContainerType) {
	codec := kbfscodec.NewMsgpack()
	zeroValue := kt.makeZero()
	encodedK, err := codec.Encode(zeroValue)
	require.NoError(t, err)

	expectedEncodedK := []byte{0xc0}
	assert.Equal(t, expectedEncodedK, encodedK)

	k, err := kt.decode(codec, encodedK)
	require.NoError(t, err)

	assert.Equal(t, zeroValue, k)
}

type verifyingKeyType struct{}

func (verifyingKeyType) makeZero() interface{} {
	return VerifyingKey{}
}

func (verifyingKeyType) makeFromKID(kid keybase1.KID) interface{} {
	return MakeVerifyingKey(kid)
}

func (verifyingKeyType) decode(
	codec *kbfscodec.CodecMsgpack, data []byte) (interface{}, error) {
	k := VerifyingKey{}
	err := codec.Decode(data, &k)
	return k, err
}

// Make sure VerifyingKey encodes and decodes properly with minimal overhead.
func TestVerifyingKeyEncodeDecode(t *testing.T) {
	testKidContainerTypeEncodeDecode(t, verifyingKeyType{})
}

// Make sure the zero VerifyingKey value encodes and decodes properly.
func TestVerifyingKeyEncodeDecodeZero(t *testing.T) {
	testKidContainerTypeEncodeDecodeZero(t, verifyingKeyType{})
}

type byte32ContainerType interface {
	makeZero() interface{}
	makeFromData(data [32]byte) interface{}
}

func testByte32ContainerEncodeDecode(t *testing.T, bt byte32ContainerType) {
	codec := kbfscodec.NewMsgpack()
	k := bt.makeFromData([32]byte{1, 2, 3, 4})

	encodedK, err := codec.Encode(k)
	require.NoError(t, err)

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	assert.Equal(t, 32+overhead, len(encodedK))

	k2 := bt.makeZero()
	err = codec.Decode(encodedK, &k2)
	require.NoError(t, err)

	assert.Equal(t, k, k2)
}

type tlfPrivateKeyType struct{}

func (tlfPrivateKeyType) makeZero() interface{} {
	return TLFPrivateKey{}
}

func (tlfPrivateKeyType) makeFromData(data [32]byte) interface{} {
	return MakeTLFPrivateKey(data)
}

// Make sure TLFPrivateKey encodes and decodes properly with minimal
// overhead.
func TestTLFPrivateKeyEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, tlfPrivateKeyType{})
}

type tlfPublicKeyType struct{}

func (tlfPublicKeyType) makeZero() interface{} {
	return TLFPublicKey{}
}

func (tlfPublicKeyType) makeFromData(data [32]byte) interface{} {
	return MakeTLFPublicKey(data)
}

// Make sure TLFPublicKey encodes and decodes properly with minimal
// overhead.
func TestTLFPublicKeyEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, tlfPublicKeyType{})
}

type tlfEphemeralPrivateKeyType struct{}

func (tlfEphemeralPrivateKeyType) makeZero() interface{} {
	return TLFEphemeralPrivateKey{}
}

func (tlfEphemeralPrivateKeyType) makeFromData(data [32]byte) interface{} {
	return MakeTLFEphemeralPrivateKey(data)
}

// Make sure TLFEphemeralPrivateKey encodes and decodes properly with minimal
// overhead.
func TestTLFEphemeralPrivateKeyEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, tlfEphemeralPrivateKeyType{})
}

type cryptPublicKeyType struct{}

func (cryptPublicKeyType) makeZero() interface{} {
	return CryptPublicKey{}
}

func (cryptPublicKeyType) makeFromKID(kid keybase1.KID) interface{} {
	return MakeCryptPublicKey(kid)
}

func (cryptPublicKeyType) decode(
	codec *kbfscodec.CodecMsgpack, data []byte) (interface{}, error) {
	k := CryptPublicKey{}
	err := codec.Decode(data, &k)
	return k, err
}

// Make sure CryptPublicKey encodes and decodes properly with minimal
// overhead.
func TestCryptPublicKeyEncodeDecode(t *testing.T) {
	testKidContainerTypeEncodeDecode(t, cryptPublicKeyType{})
}

// Make sure the zero CryptPublicKey value encodes and decodes
// properly.
func TestCryptPublicKeyEncodeDecodeZero(t *testing.T) {
	testKidContainerTypeEncodeDecodeZero(t, cryptPublicKeyType{})
}

type tlfEphemeralPublicKeyType struct{}

func (tlfEphemeralPublicKeyType) makeZero() interface{} {
	return TLFEphemeralPublicKey{}
}

func (tlfEphemeralPublicKeyType) makeFromData(data [32]byte) interface{} {
	return MakeTLFEphemeralPublicKey(data)
}

// Make sure TLFEphemeralPublicKey encodes and decodes properly with minimal
// overhead.
func TestTLFEphemeralPublicKeyEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, tlfEphemeralPublicKeyType{})
}

type tlfCryptKeyServerHalfType struct{}

func (tlfCryptKeyServerHalfType) makeZero() interface{} {
	return TLFCryptKeyServerHalf{}
}

func (tlfCryptKeyServerHalfType) makeFromData(data [32]byte) interface{} {
	return MakeTLFCryptKeyServerHalf(data)
}

// Make sure TLFCryptKeyServerHalf encodes and decodes properly with
// minimal overhead.
func TestTLFCryptKeyServerHalfEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, tlfCryptKeyServerHalfType{})
}

type tlfCryptKeyClientHalfType struct{}

func (tlfCryptKeyClientHalfType) makeZero() interface{} {
	return TLFCryptKeyClientHalf{}
}

func (tlfCryptKeyClientHalfType) makeFromData(data [32]byte) interface{} {
	return MakeTLFCryptKeyClientHalf(data)
}

// Make sure TLFCryptKeyClientHalf encodes and decodes properly with
// minimal overhead.
func TestTLFCryptKeyClientHalfEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, tlfCryptKeyClientHalfType{})
}

type tlfCryptKeyType struct{}

func (tlfCryptKeyType) makeZero() interface{} {
	return TLFCryptKey{}
}

func (tlfCryptKeyType) makeFromData(data [32]byte) interface{} {
	return MakeTLFCryptKey(data)
}

// Make sure TLFCryptKey encodes and decodes properly with minimal
// overhead.
func TestTLFCryptKeyEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, tlfCryptKeyType{})
}

type blockCryptKeyServerHalfType struct{}

func (blockCryptKeyServerHalfType) makeZero() interface{} {
	return TLFCryptKey{}
}

func (blockCryptKeyServerHalfType) makeFromData(data [32]byte) interface{} {
	return MakeTLFCryptKey(data)
}

// Make sure BlockCryptKeyServerHalf encodes and decodes properly with
// minimal overhead.
func TestBlockCryptKeyServerHalfEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, blockCryptKeyServerHalfType{})
}

type blockCryptKeyType struct{}

func (blockCryptKeyType) makeZero() interface{} {
	return TLFCryptKey{}
}

func (blockCryptKeyType) makeFromData(data [32]byte) interface{} {
	return MakeTLFCryptKey(data)
}

// Make sure BlockCryptKey encodes and decodes properly with minimal
// overhead.
func TestBlockCryptKeyEncodeDecode(t *testing.T) {
	testByte32ContainerEncodeDecode(t, blockCryptKeyType{})
}
