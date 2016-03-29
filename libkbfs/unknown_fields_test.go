package libkbfs

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// extra contains some fake extra fields that can be embedded into a
// struct to test handling of unknown fields.
type extra struct {
	Extra1 encryptedData
	Extra2 HMAC
	Extra3 string
}

func makeExtraOrBust(t *testing.T) extra {
	extraHMAC, err := DefaultHMAC([]byte("fake extra key"), []byte("fake extra buf"))
	require.Nil(t, err)
	return extra{
		Extra1: encryptedData{
			Version:       EncryptionSecretbox + 1,
			EncryptedData: []byte("fake extra encrypted data"),
			Nonce:         []byte("fake extra nonce"),
		},
		Extra2: extraHMAC,
		Extra3: "extra string",
	}
}

// structUnknownFieldsTest contains the type-specific bits of
// testStructUnknownFields. T is the struct type to be tested, and
// TFuture is the hypothetical future version of T, usually made by
// embedding both T and extra.
type structUnknownFieldsTest interface {
	// makeEmptyStruct should return T{}.
	makeEmptyStruct() interface{}

	// makeEmptyStruct should return a T filled in with some
	// values.
	makeFilledStruct() interface{}

	// filterKnownFields takes in a T and returns another T with
	// only known fields, usually made by setting
	// T.UnknownFieldSet t= codec.UnknownFieldSet{}.
	filterKnownFields(interface{}) interface{}

	// makeEmptyFutureStruct should return TFuture{}.
	makeEmptyFutureStruct() interface{}

	// makeFilledFutureStruct should return a TFuture filled in
	// with some values, which is usually a T from
	// makeFilledStruct() combined with an extra from
	// makeExtraOrBust().
	makeFilledFutureStruct() interface{}
}

// Test that hypothetical future versions of a struct can be
// deserialized by current clients and preserve unknown fields.
func testStructUnknownFields(t *testing.T, st structUnknownFieldsTest) {
	s := st.makeFilledStruct()

	sFuture := st.makeFilledFutureStruct()

	c := NewCodecMsgpack()

	buf, err := c.Encode(sFuture)
	require.Nil(t, err)

	// Make sure sFuture round-trips correctly.
	sFuture2 := st.makeEmptyFutureStruct()
	err = c.Decode(buf, &sFuture2)
	require.Nil(t, err)
	require.Equal(t, sFuture, sFuture2)

	s2 := st.makeEmptyStruct()
	err = c.Decode(buf, &s2)
	require.Nil(t, err)

	knownS2 := st.filterKnownFields(s2)

	// Make sure known fields are the same.
	require.Equal(t, s, knownS2)

	buf2, err := c.Encode(s2)
	require.Nil(t, err)

	// Make sure serializing s preserves the extra fields.
	require.Equal(t, buf, buf2)

	// As a sanity test, make sure sFuture decodes back from buf2.
	sFuture3 := st.makeEmptyFutureStruct()
	err = c.Decode(buf2, &sFuture3)
	require.Nil(t, err)
	require.Equal(t, sFuture, sFuture3)
}
