package libkbfs

import (
	"encoding"
	"encoding/hex"
	"errors"
)

const (
	// TlfIDByteLen is the number of bytes in a top-level folder ID
	TlfIDByteLen = 16
	// TlfIDStringLen is the number of characters in the string
	// representation of a top-level folder ID
	TlfIDStringLen = 2 * TlfIDByteLen
	// TlfIDSuffix is the last byte of a private top-level folder ID
	TlfIDSuffix = 0x16
	// PubTlfIDSuffix is the last byte of a public top-level folder ID
	PubTlfIDSuffix = 0x17
)

// TlfID is a top-level folder ID
type TlfID struct {
	// Exported only for serialization purposes.
	id [TlfIDByteLen]byte
}

var _ encoding.BinaryMarshaler = TlfID{}
var _ encoding.BinaryUnmarshaler = (*TlfID)(nil)

// NullTlfID is an empty TlfID
var NullTlfID = TlfID{}

// Bytes returns the bytes of the TLF ID.
func (id TlfID) Bytes() []byte {
	return id.id[:]
}

// String implements the fmt.Stringer interface for TlfID.
func (id TlfID) String() string {
	return hex.EncodeToString(id.id[:])
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for TlfID.
func (id TlfID) MarshalBinary() (data []byte, err error) {
	return id.id[:], nil
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for TlfID.
func (id *TlfID) UnmarshalBinary(data []byte) error {
	if len(data) != TlfIDByteLen {
		return errors.New("invalid TlfID")
	}
	suffix := data[TlfIDByteLen-1]
	if suffix != TlfIDSuffix && suffix != PubTlfIDSuffix {
		return errors.New("invalid TlfID")
	}
	copy(id.id[:], data)
	return nil
}

// IsPublic returns true if this TlfID is for a public top-level folder
func (id TlfID) IsPublic() bool {
	return id.id[TlfIDByteLen-1] == PubTlfIDSuffix
}

// ParseTlfID parses a hex encoded TlfID. Returns NullTlfID on failure.
func ParseTlfID(s string) TlfID {
	if len(s) != TlfIDStringLen {
		return NullTlfID
	}
	bytes, err := hex.DecodeString(s)
	if err != nil {
		return NullTlfID
	}
	var id TlfID
	err = id.UnmarshalBinary(bytes)
	if err != nil {
		id = TlfID{}
	}
	return id
}
