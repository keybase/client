package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOuterLinkV2WithMetadataEncode(t *testing.T) {
	var o OuterLinkV2WithMetadata
	_, err := MsgpackEncode(o)
	require.Equal(t, errCodecEncodeSelf, err)
	_, err = MsgpackEncode(&o)
	require.Equal(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataDecode(t *testing.T) {
	var o OuterLinkV2WithMetadata
	err := MsgpackDecode(&o, []byte{0x1, 0x2})
	require.Equal(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataEmbedder struct {
	OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataEmbedderEncode(t *testing.T) {
	var o outerLinkV2WithMetadataEmbedder
	_, err := MsgpackEncode(o)
	require.Equal(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataEmbedderDecode(t *testing.T) {
	var o outerLinkV2WithMetadataEmbedder
	err := MsgpackDecode(&o, []byte{0x1, 0x2})
	require.Equal(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataPointerEmbedder struct {
	*OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataPointerEmbedderEncode(t *testing.T) {
	var o outerLinkV2WithMetadataPointerEmbedder
	_, err := MsgpackEncode(o)
	require.Equal(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataPointerEmbedderDecode(t *testing.T) {
	var o outerLinkV2WithMetadataPointerEmbedder
	err := MsgpackDecode(&o, []byte{0x1, 0x2})
	require.Equal(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataContainer struct {
	o OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataContainerEncode(t *testing.T) {
	var o outerLinkV2WithMetadataContainer
	_, err := MsgpackEncode(o)
	require.Equal(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataContainerDecode(t *testing.T) {
	var o outerLinkV2WithMetadataContainer
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
