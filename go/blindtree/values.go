package blindtree

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
	"github.com/keybase/go-codec/codec"
)

// BlindMerkleValue simulates a union type to store values of different types in
// the Blind Merkle Tree. To add a new type, grab a new BlindMerkleValueType
// constant and update the CodecEncodeSelf and CodecDecodeSelf functions as
// appropriate.
type BlindMerkleValue struct {
	ValueType  BlindMerkleValueType
	InnerValue interface{}
}

// Note: values up to 127 are preferred as they are encoded in a single byte
type BlindMerkleValueType uint8

const (
	ValueTypeEmpty  BlindMerkleValueType = 0
	ValueTypeTeamV1 BlindMerkleValueType = 1

	ValueTypeStringForTesting BlindMerkleValueType = 127
)

var _ codec.Selfer = &BlindMerkleValue{}

func (t *BlindMerkleValue) CodecEncodeSelf(e *codec.Encoder) {
	switch t.ValueType {
	case ValueTypeTeamV1, ValueTypeStringForTesting, ValueTypeEmpty:
		// pass
	default:
		panic("Unknown merkle value type")
	}
	e.MustEncode(t.ValueType)
	e.MustEncode(t.InnerValue)
}

func (t *BlindMerkleValue) CodecDecodeSelf(d *codec.Decoder) {
	d.MustDecode(&t.ValueType)
	switch t.ValueType {
	case ValueTypeEmpty:
		// Nothing to do here
	case ValueTypeTeamV1:
		var v TeamV1Value
		d.MustDecode(&v)
		t.InnerValue = v
	case ValueTypeStringForTesting:
		var s string
		d.MustDecode(&s)
		t.InnerValue = s
	default:
		panic("Unrecognized Value Type")
	}
}

type TeamV1Value struct {
	_struct struct{} `codec:",toarray"` //nolint
	Tails   map[keybase1.SeqType]sig3.Tail
}

func BlindMerkleValueStringForTesting(s string) BlindMerkleValue {
	return BlindMerkleValue{ValueType: ValueTypeStringForTesting, InnerValue: s}
}

func BlindMerkleValueTeamV1(v TeamV1Value) BlindMerkleValue {
	return BlindMerkleValue{ValueType: ValueTypeTeamV1, InnerValue: v}
}

func BlindMerkleValueEmpty() BlindMerkleValue {
	return BlindMerkleValue{ValueType: ValueTypeEmpty, InnerValue: nil}
}
