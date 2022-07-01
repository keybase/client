// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscodec

import (
	"crypto/hmac"
	"crypto/sha256"
	"reflect"

	"github.com/stretchr/testify/require"
)

type fakeEncryptedData struct {
	Version       int
	EncryptedData []byte
	Nonce         []byte
}

// Extra contains some fake extra fields that can be embedded into a
// struct to test handling of unknown fields.
type Extra struct {
	Extra1 fakeEncryptedData
	Extra2 []byte
	Extra3 string
}

// MakeExtraOrBust returns a filled-in Extra structure based on the
// given prefix.
func MakeExtraOrBust(prefix string, t require.TestingT) Extra {
	mac := hmac.New(sha256.New, []byte("fake extra key"))
	_, _ = mac.Write([]byte("fake extra buf"))
	h := mac.Sum(nil)
	return Extra{
		Extra1: fakeEncryptedData{
			Version:       2,
			EncryptedData: []byte(prefix + " fake extra encrypted data"),
			Nonce:         []byte(prefix + " fake extra nonce"),
		},
		Extra2: h,
		Extra3: prefix + " extra string",
	}
}

// Template for implementing the interfaces below for use with
// TestStructUnknownFields, with MyType being the type to test, and
// MySubType being the type of one of its sub-fields St, which may
// also have unknown fields:
//
// type myTypeFuture struct {
//   MyType
//   // Override MyType.St.
//   St mySubTypeFuture
//   kbfscrypto.Extra
// }
//
// func (mf myTypeFuture) toCurrent() MyType {
//   m := mf.MyType
//   m.St = m.St.toCurrent()
//   return m
// }
//
// func (mf myTypeFuture) ToCurrentStruct() kbfscrypto.CurrentStruct {
//   return mf.toCurrent()
// }
//
// func makeFakeMyTypeFuture(t *testing.T) myTypeFuture {
//   mf := myTypeFuture{
//     myType{
//       // List elements (with nil for St) without keys, so that any change
//       // to the struct will necessitate making the corresponding test
//       // change.
//       codec.UnknownFieldSet{},
//     },
//     makeFakeMySubTypeFuture(t),
//     kbfscrypto.MakeExtraOrBust("MyType", t),
//   }
//   return mf
// }
//
// func TestMyTypeUnknownFields(t *testing.T) {
//   cFuture := kbfscodec.NewMsgpack()
//   registerOpsFuture(cFuture)
//
//   cCurrent := kbfscodec.NewMsgpack()
//   RegisterOps(cCurrent)
//
//   cCurrentKnownOnly := kbfscodec.NewMsgpackNoUnknownFields()
//   RegisterOps(cCurrentKnownOnly)
//
//   kbfscodec.TestStructUnknownFields(t, makeMyTypeFuture(t))
// }

// CurrentStruct is an interface for the current version of a struct
// type.
type CurrentStruct interface{}

// FutureStruct is an interface for a hypothetical future version of a
// struct type.
type FutureStruct interface {
	// toCurrentStruct returns the fields of the current object
	// copied to the current struct, with all unknown fields
	// discarded.
	ToCurrentStruct() CurrentStruct
}

// TestStructUnknownFields tests that hypothetical future versions of
// a struct can be deserialized by current clients and preserve
// unknown fields.
func TestStructUnknownFields(t require.TestingT,
	cFuture, cCurrent, cCurrentKnownOnly Codec,
	sFuture FutureStruct) {
	s := sFuture.ToCurrentStruct()

	buf, err := cFuture.Encode(sFuture)
	require.NoError(t, err)

	// Make sure sFuture round-trips correctly.
	sFuture2 := reflect.Zero(reflect.TypeOf(sFuture)).Interface()
	err = cFuture.Decode(buf, &sFuture2)
	require.NoError(t, err)
	require.Equal(t, sFuture, sFuture2)

	s2 := reflect.Zero(reflect.TypeOf(s)).Interface()
	err = cCurrent.Decode(buf, &s2)
	require.NoError(t, err)

	knownS2 := reflect.Zero(reflect.TypeOf(s)).Interface()
	err = cCurrentKnownOnly.Decode(buf, &knownS2)
	require.NoError(t, err)

	// Make sure known fields are the same.
	require.Equal(t, s, knownS2)

	buf2, err := cCurrent.Encode(s2)
	require.NoError(t, err)

	// Make sure serializing s preserves the extra fields.
	require.Equal(t, buf, buf2)

	// As a sanity test, make sure sFuture decodes back from buf2.
	sFuture3 := reflect.Zero(reflect.TypeOf(sFuture)).Interface()
	err = cFuture.Decode(buf2, &sFuture3)
	require.NoError(t, err)
	require.Equal(t, sFuture, sFuture3)
}

// TestStructUnknownFieldsMsgpack calls TestStructUnknownFields with
// codecs with the msgpack codec.
func TestStructUnknownFieldsMsgpack(t require.TestingT, sFuture FutureStruct) {
	cFuture := NewMsgpack()
	cCurrent := NewMsgpack()
	cCurrentKnownOnly := NewMsgpackNoUnknownFields()

	TestStructUnknownFields(t, cFuture, cCurrent, cCurrentKnownOnly, sFuture)
}
