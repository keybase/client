// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"encoding"
	"encoding/hex"
	"encoding/json"

	"github.com/keybase/kbfs/kbfscrypto"
)

const (
	// idByteLen is the number of bytes in a top-level folder ID
	idByteLen = 16
	// idStringLen is the number of characters in the string
	// representation of a top-level folder ID
	idStringLen = 2 * idByteLen
	// idSuffix is the last byte of a private top-level folder ID
	idSuffix = 0x16
	// pubIDSuffix is the last byte of a public top-level folder ID
	pubIDSuffix = 0x17
)

// ID is a top-level folder ID
type ID struct {
	id [idByteLen]byte
}

var _ encoding.BinaryMarshaler = ID{}
var _ encoding.BinaryUnmarshaler = (*ID)(nil)

var _ json.Marshaler = ID{}
var _ json.Unmarshaler = (*ID)(nil)

// NullID is an empty ID
var NullID = ID{}

// Bytes returns the bytes of the TLF ID.
func (id ID) Bytes() []byte {
	return id.id[:]
}

// String implements the fmt.Stringer interface for ID.
func (id ID) String() string {
	return hex.EncodeToString(id.id[:])
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for ID.
func (id ID) MarshalBinary() (data []byte, err error) {
	suffix := id.id[idByteLen-1]
	if suffix != idSuffix && suffix != pubIDSuffix {
		return nil, InvalidIDError{id.String()}
	}
	return id.id[:], nil
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for ID.
func (id *ID) UnmarshalBinary(data []byte) error {
	if len(data) != idByteLen {
		return InvalidIDError{hex.EncodeToString(data)}
	}
	suffix := data[idByteLen-1]
	if suffix != idSuffix && suffix != pubIDSuffix {
		return InvalidIDError{hex.EncodeToString(data)}
	}
	copy(id.id[:], data)
	return nil
}

// MarshalJSON implements the encoding.json.Marshaler interface for
// ID.
func (id ID) MarshalJSON() ([]byte, error) {
	return json.Marshal(id.String())
}

// UnmarshalJSON implements the encoding.json.Unmarshaler interface
// for ID.
func (id *ID) UnmarshalJSON(buf []byte) error {
	var str string
	err := json.Unmarshal(buf, &str)
	if err != nil {
		return err
	}
	newID, err := ParseID(str)
	if err != nil {
		return err
	}
	*id = newID
	return nil
}

// IsPublic returns true if this ID is for a public top-level folder
func (id ID) IsPublic() bool {
	return id.id[idByteLen-1] == pubIDSuffix
}

// ParseID parses a hex encoded ID. Returns NullID and an
// InvalidIDError on failure.
func ParseID(s string) (ID, error) {
	if len(s) != idStringLen {
		return NullID, InvalidIDError{s}
	}
	bytes, err := hex.DecodeString(s)
	if err != nil {
		return NullID, InvalidIDError{s}
	}
	var id ID
	err = id.UnmarshalBinary(bytes)
	if err != nil {
		return NullID, InvalidIDError{s}
	}
	return id, nil
}

// MakeRandomID makes a random ID using a cryptographically secure
// RNG. Returns NullID on failure.
func MakeRandomID(isPublic bool) (ID, error) {
	var idBytes [idByteLen]byte
	err := kbfscrypto.RandRead(idBytes[:])
	if err != nil {
		return NullID, err
	}
	if isPublic {
		idBytes[idByteLen-1] = pubIDSuffix
	} else {
		idBytes[idByteLen-1] = idSuffix
	}
	var id ID
	err = id.UnmarshalBinary(idBytes[:])
	if err != nil {
		return NullID, err
	}
	return id, nil
}
