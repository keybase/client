package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Test that various ways in which OuterLinkV2WithMetadata may be
// encoded/decoded all fail.

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
	O OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataContainerEncode(t *testing.T) {
	var o outerLinkV2WithMetadataContainer
	_, err := MsgpackEncode(o)
	require.Equal(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataContainerDecode(t *testing.T) {
	bytes, err := MsgpackEncode(map[string]interface{}{
		"O": []byte{0x01, 0x02},
	})
	require.NoError(t, err)

	var o outerLinkV2WithMetadataContainer
	err = MsgpackDecode(&o, bytes)
	require.Equal(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataPointerContainer struct {
	O *OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataPointerContainerEncode(t *testing.T) {
	o := outerLinkV2WithMetadataPointerContainer{
		O: &OuterLinkV2WithMetadata{},
	}
	_, err := MsgpackEncode(o)
	require.Equal(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataPointerContainerDecode(t *testing.T) {
	bytes, err := MsgpackEncode(map[string]interface{}{
		"O": []byte{0x01, 0x02},
	})
	require.NoError(t, err)

	var o outerLinkV2WithMetadataPointerContainer
	err = MsgpackDecode(&o, bytes)
	require.Equal(t, errCodecDecodeSelf, err)
}
