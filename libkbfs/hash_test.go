package libkbfs

import (
	"bytes"
	"testing"
)

// Make sure Hash encodes and decodes properly with minimal overhead.
func TestHashEncodeDecode(t *testing.T) {
	codec := NewCodecMsgpack()
	h, err := DefaultHash([]byte{1})
	if err != nil {
		t.Fatal(err)
	}

	encodedH, err := codec.Encode(h)
	if err != nil {
		t.Fatal(err)
	}

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	if len(encodedH) != DefaultHashByteLength+overhead {
		t.Errorf("expected encoded length %d, got %d",
			DefaultHashByteLength+overhead, len(encodedH))
	}

	var h2 Hash
	err = codec.Decode(encodedH, &h2)
	if err != nil {
		t.Fatal(err)
	}

	if h != h2 {
		t.Errorf("expected %s, got %s", h, h2)
	}
}

// Make sure the zero Hash value encodes and decodes properly.
func TestHashEncodeDecodeZero(t *testing.T) {
	codec := NewCodecMsgpack()
	encodedH, err := codec.Encode(Hash{})
	if err != nil {
		t.Fatal(err)
	}

	expectedEncodedH := []byte{0xc0}
	if !bytes.Equal(encodedH, expectedEncodedH) {
		t.Errorf("expected encoding %v, got %v",
			expectedEncodedH, encodedH)
	}

	var h Hash
	err = codec.Decode(encodedH, &h)
	if err != nil {
		t.Fatal(err)
	}

	if h != (Hash{}) {
		t.Errorf("expected empty hash, got %s", h)
	}
}

// Make sure that default hash gives a valid hash that verifies.
func TestDefaultHash(t *testing.T) {
	data := []byte{1, 2, 3, 4, 5}
	h, err := DefaultHash(data)
	if err != nil {
		t.Fatal(err)
	}

	if !h.IsValid() {
		t.Errorf("%s is unexpectedly invalid", h)
	}

	err = h.Verify(data)
	if err != nil {
		t.Error(err)
	}
}

// hashFromRawNoCheck() is like HashFromRaw() except it doesn't check
// validity.
func hashFromRawNoCheck(hashType HashType, rawHash []byte) Hash {
	return Hash{string(append([]byte{byte(hashType)}, rawHash...))}
}

// Make sure Hash.IsValid() fails properly.
func TestHashIsValid(t *testing.T) {
	data := []byte{1, 2, 3, 4, 5}
	validH, err := DefaultHash(data)
	if err != nil {
		t.Fatal(err)
	}

	// Zero hash.
	if (Hash{}).IsValid() {
		t.Error("Empty hash is unexpectedly valid")
	}

	var smallH Hash
	smallH.h = validH.h[:MinHashByteLength-1]
	if smallH.IsValid() {
		t.Errorf("%s is unexpectedly valid", smallH)
	}

	var largeH Hash
	padding := make([]byte, MaxHashByteLength-len(validH.h)+1)
	largeH.h = string(append([]byte(validH.h), padding...))
	if largeH.IsValid() {
		t.Errorf("%s is unexpectedly valid", largeH)
	}

	invalidH := hashFromRawNoCheck(InvalidHash, validH.hashData())
	if invalidH.IsValid() {
		t.Errorf("%s is unexpectedly valid", invalidH)
	}

	// A hash with an unknown version is still valid.
	unknownH := hashFromRawNoCheck(validH.hashType()+1, validH.hashData())
	if !unknownH.IsValid() {
		t.Errorf("%s is unexpectedly invalid", unknownH)
	}
}

// Make sure Hash.Verify() fails properly.
func TestHashVerify(t *testing.T) {
	data := []byte{1, 2, 3, 4, 5}

	// Zero (invalid) hash.
	err := (Hash{}).Verify(data)
	if err != (InvalidHashError{Hash{}}) {
		t.Error(err)
	}

	validH, err := DefaultHash(data)
	if err != nil {
		t.Fatal(err)
	}

	corruptData := make([]byte, len(data))
	copy(corruptData, data)
	corruptData[0] ^= 1
	err = validH.Verify(corruptData)
	if _, ok := err.(HashMismatchError); !ok {
		t.Error(err)
	}

	invalidH := hashFromRawNoCheck(InvalidHash, validH.hashData())
	err = invalidH.Verify(data)
	if err != (InvalidHashError{invalidH}) {
		t.Error(err)
	}

	unknownType := validH.hashType() + 1
	unknownH := hashFromRawNoCheck(unknownType, validH.hashData())
	err = unknownH.Verify(data)
	if err != (UnknownHashTypeError{unknownType}) {
		t.Error(err)
	}

	hashData := validH.hashData()
	hashData[0] ^= 1
	corruptH := hashFromRawNoCheck(validH.hashType(), hashData)
	err = corruptH.Verify(data)
	if _, ok := err.(HashMismatchError); !ok {
		t.Error(err)
	}
}

// Make sure HMAC encodes and decodes properly with minimal overhead.
func TestHMACEncodeDecode(t *testing.T) {
	codec := NewCodecMsgpack()
	hmac, err := DefaultHMAC([]byte{1}, []byte{2})
	if err != nil {
		t.Fatal(err)
	}

	encodedHMAC, err := codec.Encode(hmac)
	if err != nil {
		t.Fatal(err)
	}

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	if len(encodedHMAC) != DefaultHashByteLength+overhead {
		t.Errorf("expected encoded length %d, got %d",
			DefaultHashByteLength+overhead, len(encodedHMAC))
	}

	var hmac2 HMAC
	err = codec.Decode(encodedHMAC, &hmac2)
	if err != nil {
		t.Fatal(err)
	}

	if hmac != hmac2 {
		t.Errorf("expected %s, got %s", hmac, hmac2)
	}
}

// Make sure the zero Hash value encodes and decodes properly.
func TestHMACEncodeDecodeZero(t *testing.T) {
	codec := NewCodecMsgpack()
	encodedHMAC, err := codec.Encode(HMAC{})
	if err != nil {
		t.Fatal(err)
	}

	expectedEncodedHMAC := []byte{0xc0}
	if !bytes.Equal(encodedHMAC, expectedEncodedHMAC) {
		t.Errorf("expected encoding %v, got %v",
			expectedEncodedHMAC, encodedHMAC)
	}

	var hmac HMAC
	err = codec.Decode(encodedHMAC, &hmac)
	if err != nil {
		t.Fatal(err)
	}

	if hmac != (HMAC{}) {
		t.Errorf("expected empty HMAC, got %s", hmac)
	}
}

// Make sure that default HMAC gives a valid HMAC that verifies.
func TestDefaultHMAC(t *testing.T) {
	key := []byte{1, 2}
	data := []byte{1, 2, 3, 4, 5}
	hmac, err := DefaultHMAC(key, data)
	if err != nil {
		t.Fatal(err)
	}

	if !hmac.IsValid() {
		t.Errorf("%s is unexpectedly invalid", hmac)
	}

	err = hmac.Verify(key, data)
	if err != nil {
		t.Error(err)
	}
}

// No need to test HMAC.IsValid().

// hmacFromRawNoCheck() is like HmacFromRaw() except it doesn't check
// validity.
func hmacFromRawNoCheck(hashType HashType, rawHash []byte) HMAC {
	h := hashFromRawNoCheck(hashType, rawHash)
	return HMAC{h}
}

// Make sure HMAC.Verify() fails properly.
func TestVerify(t *testing.T) {
	key := []byte{1, 2}
	data := []byte{1, 2, 3, 4, 5}

	// Zero (invalid) HMAC.
	err := (HMAC{}).Verify(key, data)
	if err != (InvalidHashError{Hash{}}) {
		t.Error(err)
	}

	validHMAC, err := DefaultHMAC(key, data)
	if err != nil {
		t.Fatal(err)
	}

	corruptKey := make([]byte, len(key))
	copy(corruptKey, key)
	corruptKey[0] ^= 1
	err = validHMAC.Verify(corruptKey, data)
	if _, ok := err.(HashMismatchError); !ok {
		t.Error(err)
	}

	corruptData := make([]byte, len(data))
	copy(corruptData, data)
	corruptData[0] ^= 1
	err = validHMAC.Verify(key, corruptData)
	if _, ok := err.(HashMismatchError); !ok {
		t.Error(err)
	}

	invalidHMAC := hmacFromRawNoCheck(InvalidHash, validHMAC.hashData())
	err = invalidHMAC.Verify(key, data)
	if err != (InvalidHashError{invalidHMAC.h}) {
		t.Error(err)
	}

	unknownType := validHMAC.hashType() + 1
	unknownHMAC := hmacFromRawNoCheck(unknownType, validHMAC.hashData())
	err = unknownHMAC.Verify(key, data)
	if err != (UnknownHashTypeError{unknownType}) {
		t.Error(err)
	}

	hashData := validHMAC.hashData()
	hashData[0] ^= 1
	corruptHMAC := hmacFromRawNoCheck(validHMAC.hashType(), hashData)
	err = corruptHMAC.Verify(key, data)
	if _, ok := err.(HashMismatchError); !ok {
		t.Error(err)
	}
}
