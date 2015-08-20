package libkbfs

import "encoding"

// BlockID is the (usually content-based) ID for a data block.
type BlockID struct {
	h Hash
}

var _ encoding.BinaryMarshaler = BlockID{}
var _ encoding.BinaryUnmarshaler = (*BlockID)(nil)

// MaxBlockIDStringLength is the maximum length of the string
// representation of a BlockID.
const MaxBlockIDStringLength = MaxHashStringLength

// BlockIDFromString creates a BlockID from the given string. If the
// returned error is nil, the returned Hash is valid.
func BlockIDFromString(dataStr string) (BlockID, error) {
	h, err := HashFromString(dataStr)
	if err != nil {
		return BlockID{}, err
	}
	return BlockID{h}, nil
}

// Bytes returns the bytes of the block ID.
func (id BlockID) Bytes() []byte {
	return id.h.Bytes()
}

func (id BlockID) String() string {
	return id.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// BlockID. Returns an error if the BlockID is invalid and not the zero
// BlockID.
func (id BlockID) MarshalBinary() (data []byte, err error) {
	return id.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for BlockID. Returns an error if the given byte array is non-empty and
// the BlockID is invalid.
func (id *BlockID) UnmarshalBinary(data []byte) error {
	return id.h.UnmarshalBinary(data)
}
