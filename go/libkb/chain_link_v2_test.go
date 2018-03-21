package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOuterLinkV2Encode(t *testing.T) {
	var o OuterLinkV2WithMetadata
	_, err := MsgpackEncode(o)
	require.Equal(t, errCodecEncodeSelf, err)
	_, err = MsgpackEncode(&o)
	require.Equal(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2Decode(t *testing.T) {
	var o OuterLinkV2WithMetadata
	err := MsgpackDecode(&o, []byte{0x1, 0x2})
	require.Equal(t, errCodecDecodeSelf, err)
}

type withMetadataContainer struct {
	o OuterLinkV2WithMetadata
}

type withMetadataPointerContainer struct {
	o *OuterLinkV2WithMetadata
}

func TestOuterLinkV2ContainerCodec(t *testing.T) {
	var c1 withMetadataContainer
	_, err := MsgpackEncode(c1)
	require.NoError(t, err)

	c2 := withMetadataPointerContainer{
		o: &OuterLinkV2WithMetadata{},
	}
	_, err = MsgpackEncode(c2)
	require.NoError(t, err)
}
