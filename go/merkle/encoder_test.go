package merkle

import (
	"bytes"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func dummy(i int) []byte {
	return bytes.Repeat([]byte{byte(i)}, 32)
}
func dummy16(i int) (ret [16]byte) {
	x := dummy(i)
	copy(ret[:], x)
	return ret
}
func dummy32(i int) (ret [32]byte) {
	x := dummy(i)
	copy(ret[:], x)
	return ret
}

func TestEncode(t *testing.T) {
	var tests = []struct {
		desc            string
		encodingType    EncodingType
		leaf            Leaf
		key             []byte
		secret          []byte
		expectedBlinder []byte
	}{
		{
			desc:         "basic",
			encodingType: EncodingTypeBlindedSHA512_256v1,
			leaf: Teamv1Leaf{
				TeamID: dummy16(0),
				Tails: map[keybase1.SeqType]Teamv1HiddenTail{
					0: {
						SigID:  dummy(1),
						LinkID: dummy32(2),
						Seqno:  123,
					},
				},
			},
			key:    dummy(3),
			secret: dummy(4),
			expectedBlinder: []byte{0xed, 0x81, 0x7b, 0x7a, 0x7, 0xec, 0x6,
				0x5f, 0x1a, 0x93, 0x4c, 0xf8, 0x6f, 0x9f, 0xf9, 0x53, 0xdd, 0xff,
				0x3, 0x26, 0x63, 0xcd, 0x15, 0xf2, 0x9e, 0x2e, 0x55, 0x3e, 0x25,
				0x67, 0x22, 0xd6},
		},
		{
			desc:         "ensure different secret produces different blinder with same leaf",
			encodingType: EncodingTypeBlindedSHA512_256v1,
			leaf: Teamv1Leaf{
				Tails: map[keybase1.SeqType]Teamv1HiddenTail{
					0: {
						SigID:  dummy(1),
						LinkID: dummy32(2),
						Seqno:  123,
					},
				},
			},
			key:    dummy(3),
			secret: dummy(5),
			expectedBlinder: []byte{0xca, 0xb7, 0xd3, 0x13, 0x3f, 0xb0, 0xb8,
				0x24, 0x8e, 0xe6, 0xad, 0x70, 0xa9, 0x1c, 0x4, 0x62, 0x8f, 0x11,
				0x35, 0x85, 0x6a, 0xea, 0x1f, 0x7c, 0x41, 0xb3, 0x33, 0xbd, 0x8b,
				0x9b, 0xa8, 0xf8},
		},
		{
			desc:         "ensure different leaf produces different blinder with same secret",
			encodingType: EncodingTypeBlindedSHA512_256v1,
			leaf: Teamv1Leaf{
				TeamID: dummy16(0),
				Tails: map[keybase1.SeqType]Teamv1HiddenTail{
					0: {
						SigID:  dummy(1),
						LinkID: dummy32(3),
						Seqno:  123,
					},
				},
			},
			key:    dummy(3),
			secret: dummy(4),
			expectedBlinder: []byte{0x8c, 0x9b, 0x7e, 0xdf, 0xc4, 0x3d, 0xdd,
				0xa8, 0xcf, 0xb2, 0x20, 0xe0, 0x11, 0x7c, 0x6a, 0x65, 0x59, 0x38,
				0x18, 0x43, 0x8a, 0x2e, 0x16, 0xc1, 0xbc, 0xa9, 0xa, 0xac, 0xd2,
				0xdb, 0xd5, 0x58},
		},
	}
	for _, tt := range tests {
		e := NewEncoder(tt.encodingType)
		t.Run(tt.desc, func(t *testing.T) {
			blinder, err := e.Encode(tt.leaf, NewKey(tt.key), NewSecret(tt.secret))
			require.NoError(t, err)
			require.Equal(t, tt.expectedBlinder, blinder)

			preimage, err := e.BlindedPreimage(tt.leaf, NewKey(tt.key), NewSecret(tt.secret))
			require.NoError(t, err)
			blinder2, err := e.Hash(preimage)
			require.NoError(t, err)
			require.Equal(t, blinder, blinder2, "got same blinder via validation route")
		})
	}

}

func TestGenerateSecret(t *testing.T) {
	e := NewEncoder(EncodingTypeBlindedSHA512_256v1)
	x, err := e.GenerateSecret()
	require.NoError(t, err)
	y, err := e.GenerateSecret()
	require.NoError(t, err)

	require.NotEqual(t, x, y)
}
