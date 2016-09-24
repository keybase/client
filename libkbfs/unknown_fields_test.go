// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/stretchr/testify/require"
)

// extra contains some fake extra fields that can be embedded into a
// struct to test handling of unknown fields.
type extra struct {
	Extra1 encryptedData
	Extra2 HMAC
	Extra3 string
}

func makeExtraOrBust(prefix string, t *testing.T) extra {
	extraHMAC, err := DefaultHMAC([]byte("fake extra key"), []byte("fake extra buf"))
	require.NoError(t, err)
	return extra{
		Extra1: encryptedData{
			Version:       EncryptionSecretbox + 1,
			EncryptedData: []byte(prefix + " fake extra encrypted data"),
			Nonce:         []byte(prefix + " fake extra nonce"),
		},
		Extra2: extraHMAC,
		Extra3: prefix + " extra string",
	}
}

// Template for implementing the interfaces below for use with
// testStructUnknownFields, with MyType being the type to test, and
// MySubType being the type of one of its sub-fields St, which may
// also have unknown fields:
//
// type myTypeFuture struct {
//   MyType
//   // Override MyType.St.
//   St mySubTypeFuture
//   extra
// }
//
// func (mf myTypeFuture) toCurrent() MyType {
//   m := mf.MyType
//   m.St = m.St.toCurrent()
//   return m
// }
//
// func (mf myTypeFuture) toCurrentStruct() currentStruct {
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
//     makeExtraOrBust("MyType", t),
//   }
//   return mf
// }
//
// func TestMyTypeUnknownFields(t *testing.T) {
//   testStructUnknownFields(t, makeMyTypeFuture(t))
// }

// currentStruct is an interface for the current version of a struct
// type.
type currentStruct interface{}

// futureStruct is an interface for a hypothetical future version of a
// struct type.
type futureStruct interface {
	// toCurrentStruct returns the fields of the current object
	// copied to the current struct, with all unknown fields
	// discarded.
	toCurrentStruct() currentStruct
}

// Test that hypothetical future versions of a struct can be
// deserialized by current clients and preserve unknown fields.
func testStructUnknownFields(t *testing.T, sFuture futureStruct) {
	cFuture := kbfscodec.NewMsgpack()
	registerOpsFuture(cFuture)

	cCurrent := kbfscodec.NewMsgpack()
	RegisterOps(cCurrent)

	cCurrentKnownOnly := kbfscodec.NewMsgpackNoUnknownFields()
	RegisterOps(cCurrentKnownOnly)

	s := sFuture.toCurrentStruct()

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
