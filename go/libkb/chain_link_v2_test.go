package libkb

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/msgpack"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	_, err := msgpack.Encode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
	_, err = msgpack.Encode(&o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataDecode(t *testing.T) {
	var o OuterLinkV2WithMetadata
	err := msgpack.Decode(&o, []byte{0x1, 0x2})
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataEmbedder struct {
	OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataEmbedderEncode(t *testing.T) {
	var o outerLinkV2WithMetadataEmbedder
	_, err := msgpack.Encode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataEmbedderDecode(t *testing.T) {
	var o outerLinkV2WithMetadataEmbedder
	err := msgpack.Decode(&o, []byte{0x1, 0x2})
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataPointerEmbedder struct {
	*OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataPointerEmbedderEncode(t *testing.T) {
	o := outerLinkV2WithMetadataPointerEmbedder{
		OuterLinkV2WithMetadata: &OuterLinkV2WithMetadata{},
	}
	_, err := msgpack.Encode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataPointerEmbedderDecode(t *testing.T) {
	var o outerLinkV2WithMetadataPointerEmbedder
	err := msgpack.Decode(&o, []byte{0x1, 0x2})
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataContainer struct {
	O OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataContainerEncode(t *testing.T) {
	var o outerLinkV2WithMetadataContainer
	_, err := msgpack.Encode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataContainerDecode(t *testing.T) {
	bytes, err := msgpack.Encode(map[string]interface{}{
		"O": []byte{0x01, 0x02},
	})
	require.NoError(t, err)

	var o outerLinkV2WithMetadataContainer
	err = msgpack.Decode(&o, bytes)
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

type outerLinkV2WithMetadataPointerContainer struct {
	O *OuterLinkV2WithMetadata
}

func TestOuterLinkV2WithMetadataPointerContainerEncode(t *testing.T) {
	o := outerLinkV2WithMetadataPointerContainer{
		O: &OuterLinkV2WithMetadata{},
	}
	_, err := msgpack.Encode(o)
	requireErrorHasSuffix(t, errCodecEncodeSelf, err)
}

func TestOuterLinkV2WithMetadataPointerContainerDecode(t *testing.T) {
	bytes, err := msgpack.Encode(map[string]interface{}{
		"O": []byte{0x01, 0x02},
	})
	require.NoError(t, err)

	var o outerLinkV2WithMetadataPointerContainer
	err = msgpack.Decode(&o, bytes)
	requireErrorHasSuffix(t, errCodecDecodeSelf, err)
}

func serdeOuterLink(t *testing.T, tc TestContext, seqno keybase1.Seqno, highSkipSeqno *keybase1.Seqno, highSkipHash LinkID) OuterLinkV2 {
	m := NewMetaContextForTest(tc)

	AddEnvironmentFeatureForTest(tc, EnvironmentFeatureAllowHighSkips)

	var highSkip *HighSkip
	highSkip = nil
	if highSkipSeqno != nil {
		highSkipPre := NewHighSkip(*highSkipSeqno, highSkipHash)
		highSkip = &highSkipPre
	}
	encoded, err := encodeOuterLink(m, LinkTypeLeave, seqno, nil, nil, false, keybase1.SeqType_PUBLIC, false, highSkip)
	require.NoError(t, err)

	o2 := OuterLinkV2{}
	err = msgpack.Decode(&o2, encoded)
	require.NoError(t, err)
	return o2
}

func highSkipMatch(ol OuterLinkV2, highSkip *HighSkip) error {
	return ol.AssertFields(ol.Version, ol.Seqno, ol.Prev, ol.Curr, ol.LinkType, ol.SeqType, ol.IgnoreIfUnsupported, highSkip)
}

func TestHighSkipBackwardsCompatibility(t *testing.T) {
	tc := SetupTest(t, "test_high_skip_backwards_compatibility", 1)
	defer tc.Cleanup()

	seqno := keybase1.Seqno(1)
	highSkipSeqno := keybase1.Seqno(0)

	o := serdeOuterLink(t, tc, seqno, nil, nil)
	require.True(t, o.HighSkipSeqno == nil)
	require.True(t, o.HighSkipHash == nil)
	require.NoError(t, highSkipMatch(o, nil))

	o = serdeOuterLink(t, tc, seqno, &highSkipSeqno, nil)
	require.True(t, *o.HighSkipSeqno == 0)
	require.True(t, o.HighSkipHash == nil)
	highSkip := NewHighSkip(keybase1.Seqno(0), nil)
	badHighSkip1 := NewHighSkip(keybase1.Seqno(0), []byte{0, 5, 2})
	badHighSkip2 := NewHighSkip(keybase1.Seqno(2), nil)
	require.NoError(t, highSkipMatch(o, &highSkip))
	require.Error(t, highSkipMatch(o, &badHighSkip1))
	require.Error(t, highSkipMatch(o, &badHighSkip2))

	seqno = keybase1.Seqno(10)
	highSkipSeqno = keybase1.Seqno(5)

	highSkipHash := []byte{0, 6, 2, 42, 123}
	o = serdeOuterLink(t, tc, seqno, &highSkipSeqno, highSkipHash)
	highSkip = NewHighSkip(keybase1.Seqno(5), highSkipHash)
	badHighSkip1 = NewHighSkip(keybase1.Seqno(5), []byte{0, 5, 2})
	badHighSkip2 = NewHighSkip(keybase1.Seqno(5), nil)
	require.NoError(t, highSkipMatch(o, &highSkip))
	require.Error(t, highSkipMatch(o, &badHighSkip1))
	require.Error(t, highSkipMatch(o, &badHighSkip2))
}
