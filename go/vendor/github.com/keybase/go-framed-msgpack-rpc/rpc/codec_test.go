package rpc

import (
	"bytes"
	"math"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/keybase/go-codec/codec"
)

// This test determines the behavior of codec with respect to advancing the
// Reader when decoding error scenarios. It seems that the codec advances
// the Reader if Decode fails, but sets its own state to expect a specific
// type for the next Decode, and thus is functionally the same as not
// advancing the Reader.
func TestCodec(t *testing.T) {
	var buf bytes.Buffer
	mh := &codec.MsgpackHandle{WriteExt: true}
	enc := codec.NewEncoder(&buf, mh)
	dec := codec.NewDecoder(&buf, mh)

	var i int = math.MaxInt32
	err := enc.Encode(i)
	require.Nil(t, err, "expected encoding to succeed")
	require.Equal(t, 5, len(buf.Bytes()), "expected buffer to contain bytes")

	var targetInt int
	err = dec.Decode(&targetInt)
	require.Nil(t, err, "expected decoding to succeed")
	require.Equal(t, math.MaxInt32, targetInt, "expected codec to successfully decode int")
	require.Equal(t, 0, len(buf.Bytes()), "expected buffer to be empty")

	var targetString string
	enc.Encode(i)
	require.Equal(t, 5, len(buf.Bytes()), "expected buffer to contain bytes")
	err = dec.Decode(&targetString)
	require.Error(t, err, "expected error while decoding")
	require.Contains(t, err.Error(), "Unrecognized descriptor byte", "expected error while decoding")
	require.Equal(t, 4, len(buf.Bytes()), "expected buffer to have bytes")
	err = dec.Decode(&targetString)
	require.Error(t, err, "expected error while decoding")
	require.Contains(t, err.Error(), "Unrecognized descriptor byte", "expected error while decoding")
	require.Equal(t, 4, len(buf.Bytes()), "expected buffer to have bytes")

	targetInt = 0
	err = dec.Decode(&targetInt)
	require.Nil(t, err, "expected decoding to succeed")
	require.Equal(t, math.MaxInt32, targetInt, "expected codec to successfully decode int")
	require.Equal(t, 0, len(buf.Bytes()), "expected buffer to be empty")
}

func TestMap(t *testing.T) {
	var buf bytes.Buffer
	mh := newCodecMsgpackHandle()
	enc := codec.NewEncoder(&buf, mh)
	dec := codec.NewDecoder(&buf, mh)

	m := map[string]string{
		"hello": "world",
		"foo":   "bar",
	}
	err := enc.Encode(m)
	require.Nil(t, err, "expected encoding to succeed")

	var targetMap map[string]string
	err = dec.Decode(&targetMap)
	require.Nil(t, err, "expected decoding to succeed")
	require.Equal(t, m, targetMap)

	var zeroMap map[string]string
	var targetMapInterface interface{}
	err = enc.Encode(zeroMap)
	require.Nil(t, err, "expected encoding to succeed")

	err = dec.Decode(&targetMapInterface)
	require.Nil(t, err, "expected decoding to succeed")
	require.Equal(t, 0, len(buf.Bytes()))

	err = enc.Encode([]interface{}{"hello", "world", m})
	require.Nil(t, err, "expected encoding to succeed")
	var a string
	var b string
	var c map[string]string
	i := []interface{}{&a, &b, &c}
	err = dec.Decode(&i)
	require.Nil(t, err, "expected decoding to succeed")
	require.Equal(t, 0, len(buf.Bytes()))
	require.Equal(t, "hello", a)
	require.Equal(t, "world", b)
	require.Equal(t, m, c)
}
