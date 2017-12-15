package rpc

import (
	"bytes"
	"encoding/base64"
	"github.com/keybase/go-codec/codec"
	"io/ioutil"
	"testing"

	"github.com/stretchr/testify/require"
)

// Test an output from objective C that was breaking the server
func TestObjcOutput(t *testing.T) {
	dat, err := ioutil.ReadFile("objc_output.dat")
	require.Nil(t, err, "an error occurred while reading dat file")
	v, err := base64.StdEncoding.DecodeString(string(dat))
	require.Nil(t, err, "an error occurred while decoding base64 dat file")

	buf := bytes.NewBuffer(v)
	var i int
	mh := newCodecMsgpackHandle()
	dec := codec.NewDecoder(buf, mh)
	err = dec.Decode(&i)
	require.Nil(t, err, "an error occurred while decoding an integer")
	require.Equal(t, buf.Len(), i, "Bad frame")

	var a interface{}
	err = dec.Decode(&a)
	require.Nil(t, err, "an error occurred while decoding object")
}
