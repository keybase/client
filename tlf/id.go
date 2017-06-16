// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"encoding"
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/pkg/errors"
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
	// singleTeamIDSuffix is the last byte of a single-team top-level
	// folder ID
	singleTeamIDSuffix = 0x26
)

// Type is the type of TLF represented by a particular ID (e.g.,
// public, private, etc.)
type Type int

const (
	// Unknown is a placeholder type for when TLF type information is not
	// available. It is the zero value of the type Type.
	Unknown Type = iota
	// Private represents a private TLF between one or more individual users.
	Private
	// Public represents a public TLF for one or more individual users.
	Public
	// SingleTeam represents a private TLF for a single Keybase team.
	SingleTeam
)

func (t Type) String() string {
	switch t {
	case Private:
		return "private"
	case Public:
		return "public"
	case SingleTeam:
		return "singleTeam"
	default:
		return fmt.Sprintf("Unknown TLF type: %d", t)
	}
}

// FolderType returns the keybase1.FolderType corresponding to the
// given TLF type.
func (t Type) FolderType() keybase1.FolderType {
	switch t {
	case Private:
		return keybase1.FolderType_PRIVATE
	case Public:
		return keybase1.FolderType_PUBLIC
	case SingleTeam:
		return keybase1.FolderType_TEAM
	default:
		return keybase1.FolderType_UNKNOWN
	}
}

// ID is a top-level folder ID
type ID struct {
	id [idByteLen]byte
}

var _ encoding.BinaryMarshaler = ID{}
var _ encoding.BinaryUnmarshaler = (*ID)(nil)

var _ encoding.TextMarshaler = ID{}
var _ encoding.TextUnmarshaler = (*ID)(nil)

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
	if suffix != idSuffix && suffix != pubIDSuffix &&
		suffix != singleTeamIDSuffix {
		return nil, errors.WithStack(InvalidIDError{id.String()})
	}
	return id.id[:], nil
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for ID.
func (id *ID) UnmarshalBinary(data []byte) error {
	if len(data) != idByteLen {
		return errors.WithStack(
			InvalidIDError{hex.EncodeToString(data)})
	}
	suffix := data[idByteLen-1]
	if suffix != idSuffix && suffix != pubIDSuffix &&
		suffix != singleTeamIDSuffix {
		return errors.WithStack(
			InvalidIDError{hex.EncodeToString(data)})
	}
	copy(id.id[:], data)
	return nil
}

// MarshalText implements the encoding.TextMarshaler interface for ID.
func (id ID) MarshalText() ([]byte, error) {
	bytes, err := id.MarshalBinary()
	if err != nil {
		return nil, err
	}
	return []byte(hex.EncodeToString(bytes)), nil
}

// UnmarshalText implements the encoding.TextUnmarshaler interface for
// ID.
func (id *ID) UnmarshalText(buf []byte) error {
	s := string(buf)
	bytes, err := hex.DecodeString(s)
	if err != nil {
		return errors.WithStack(InvalidIDError{s})
	}
	return id.UnmarshalBinary(bytes)
}

// Type returns the type of TLF represented by this ID.
//
// Note that this function panics if the ID suffix is unknown, rather than
// returning tlf.Unkonwn.
func (id ID) Type() Type {
	switch id.id[idByteLen-1] {
	case idSuffix:
		return Private
	case pubIDSuffix:
		return Public
	case singleTeamIDSuffix:
		return SingleTeam
	default:
		panic(fmt.Sprintf("Unknown ID suffix  %x", id.id[idByteLen-1]))
	}
}

// ParseID parses a hex encoded ID. Returns NullID and an
// InvalidIDError on failure.
func ParseID(s string) (ID, error) {
	var id ID
	err := id.UnmarshalText([]byte(s))
	if err != nil {
		return ID{}, err
	}
	return id, nil
}

// MakeRandomID makes a random ID using a cryptographically secure
// RNG. Returns NullID on failure.
func MakeRandomID(t Type) (ID, error) {
	var idBytes [idByteLen]byte
	err := kbfscrypto.RandRead(idBytes[:])
	if err != nil {
		return NullID, err
	}
	switch t {
	case Private:
		idBytes[idByteLen-1] = idSuffix
	case Public:
		idBytes[idByteLen-1] = pubIDSuffix
	case SingleTeam:
		idBytes[idByteLen-1] = singleTeamIDSuffix
	default:
		panic(fmt.Sprintf("Unknown TLF type %d", t))
	}
	var id ID
	err = id.UnmarshalBinary(idBytes[:])
	if err != nil {
		return NullID, err
	}
	return id, nil
}
