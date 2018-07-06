package libkb

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// requireErrorHasSuffix makes sure that err's string has
// expectedErrSuffix's string as a suffix. This is necessary as
// go-codec prepends stuff to any errors it catches.
func requireErrorHasSuffix(t *testing.T, expectedErrSuffix, err error) {
	t.Helper()
	require.Error(t, err)
	require.True(t, strings.HasSuffix(err.Error(), expectedErrSuffix.Error()), "Expected %q to have %q as a suffix", err, expectedErrSuffix)
}

// Test that various ways in which OuterLinkV2WithMetadata may be
// encoded/decoded all fail.

func TestOuterLinkV2WithMetadataEncode(t *testing.T) {
	var o OuterLinkV2WithMetadata
	_, err := MsgpackEncode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
	_, err = MsgpackEncode(&o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataDecode(t *testing.T) {
	var o OuterLinkV2WithMetadata
	err := MsgpackDecode(&o, []byte{0x1, 0x2})
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataEmbedder struct {
	OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataEmbedderEncode(t *testing.T) {
	var o outerLinkV2WithMetadataEmbedder
	_, err := MsgpackEncode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataEmbedderDecode(t *testing.T) {
	var o outerLinkV2WithMetadataEmbedder
	err := MsgpackDecode(&o, []byte{0x1, 0x2})
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataPointerEmbedder struct {
	*OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataPointerEmbedderEncode(t *testing.T) {
	o := outerLinkV2WithMetadataPointerEmbedder{
		OuterLinkV2WithMetadata: &OuterLinkV2WithMetadata{},
	}
	_, err := MsgpackEncode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataPointerEmbedderDecode(t *testing.T) {
	var o outerLinkV2WithMetadataPointerEmbedder
	err := MsgpackDecode(&o, []byte{0x1, 0x2})
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataContainer struct {
	O OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataContainerEncode(t *testing.T) {
	var o outerLinkV2WithMetadataContainer
	_, err := MsgpackEncode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataContainerDecode(t *testing.T) {
	bytes, err := MsgpackEncode(map[string]interface{}{
		"O": []byte{0x01, 0x02},
	})
	require.NoError(t, err)

	var o outerLinkV2WithMetadataContainer
	err = MsgpackDecode(&o, bytes)
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataPointerContainer struct {
	O *OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataPointerContainerEncode(t *testing.T) {
	o := outerLinkV2WithMetadataPointerContainer{
		O: &OuterLinkV2WithMetadata{},
	}
	_, err := MsgpackEncode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataPointerContainerDecode(t *testing.T) {
	bytes, err := MsgpackEncode(map[string]interface{}{
		"O": []byte{0x01, 0x02},
	})
	require.NoError(t, err)

	var o outerLinkV2WithMetadataPointerContainer
	err = MsgpackDecode(&o, bytes)
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}
