// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"bytes"
	"encoding"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

const (
	// idByteLen is the number of bytes in a top-level folder ID
	idByteLen = 16
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

const (
	strPrivate    = "private"
	strPublic     = "public"
	strSingleTeam = "singleTeam"
	strTeam       = "team"
)

func (t Type) String() string {
	switch t {
	case Private:
		return strPrivate
	case Public:
		return strPublic
	case SingleTeam:
		return strSingleTeam
	default:
		return fmt.Sprintf("Unknown TLF type: %d", t)
	}
}

// MarshalText implements the encoding.TextMarshaler interface for Type.
func (t Type) MarshalText() ([]byte, error) {
	return []byte(t.String()), nil
}

// PathString returns the string representation of t, when they are used in a
// KBFS path. This is different from String() where this one returns 'team'
// instead of 'singleTeam' for SingleTeam.
func (t Type) PathString() string {
	switch t {
	case Private:
		return strPrivate
	case Public:
		return strPublic
	case SingleTeam:
		return strTeam
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

// ErrUnknownTLFType is returned by ParseTlfType when an unknown TLF type
// string is provided.
type ErrUnknownTLFType struct {
	unknownType string
}

// Error implements the error interface.
func (e ErrUnknownTLFType) Error() string {
	return "unknown TLF type: " + e.unknownType
}

// ParseTlfTypeFromPath parses str into a Type.
func ParseTlfTypeFromPath(str string) (Type, error) {
	switch strings.ToLower(str) {
	case strPrivate:
		return Private, nil
	case strPublic:
		return Public, nil
	case strTeam:
		return SingleTeam, nil
	default:
		return Unknown, ErrUnknownTLFType{unknownType: str}
	}
}

// TypeFromFolderType returns the Type corresponding to the given
// keybase1.FolderType.
func TypeFromFolderType(ft keybase1.FolderType) Type {
	switch ft {
	case keybase1.FolderType_PRIVATE:
		return Private
	case keybase1.FolderType_PUBLIC:
		return Public
	case keybase1.FolderType_TEAM:
		return SingleTeam
	default:
		return Unknown
	}
}

// KeyingType represents a TLF keying mode. It normally have the same values
// as Type.
type KeyingType Type

const (
	// UnknownKeying is a placeholder type for when TLF keying mode is unknown.
	UnknownKeying = KeyingType(Unknown)
	// PrivateKeying specifies the TLF keying mode used in classic private TLFs.
	PrivateKeying = KeyingType(Private)
	// PublicKeying specifies the TLF keying mode used in classic public TLFs.
	PublicKeying = KeyingType(Public)
	// TeamKeying specifies the TLF keying mode used for SingleTeam or
	// implicit team backed TLFs.
	TeamKeying = KeyingType(SingleTeam)
)

// ToKeyingType converts Type t into a KeyingType.
func (t Type) ToKeyingType() KeyingType {
	return KeyingType(t)
}

// String implements the fmt.Stringer interface.
func (t KeyingType) String() string {
	switch t {
	case PrivateKeying:
		return "private keying"
	case PublicKeying:
		return "public keying"
	case TeamKeying:
		return "team keying"
	default:
		return fmt.Sprintf("Unknown TLF keying type: %d", t)
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

// SafeType returns the type of TLF represented by this ID.  If the ID
// isn't valid, it returns tlf.Unknown along with an error.
func (id ID) SafeType() (Type, error) {
	switch id.id[idByteLen-1] {
	case idSuffix:
		return Private, nil
	case pubIDSuffix:
		return Public, nil
	case singleTeamIDSuffix:
		return SingleTeam, nil
	default:
		return Unknown, fmt.Errorf("Unknown ID suffix  %x", id.id[idByteLen-1])
	}
}

// Type returns the type of TLF represented by this ID.
//
// Note that this function panics if the ID suffix is unknown, rather than
// returning tlf.Unknown.
func (id ID) Type() Type {
	t, err := id.SafeType()
	if err != nil {
		panic(err)
	}
	return t
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

// MakeIDFromTeam makes a deterministic TLF ID from a team ID and an epoch
// representing how many times a new TLF has been needed for this
// team.  Returns NullID on failure.
func MakeIDFromTeam(t Type, tid keybase1.TeamID, epoch byte) (ID, error) {
	idBytes := tid.ToBytes()
	if len(idBytes) != idByteLen {
		return NullID, errors.Errorf(
			"The length of team ID %s doesn't match that of a TLF ID", tid)
	}

	idBytes[idByteLen-2] = epoch

	switch t {
	case Private:
		if tid.IsPublic() {
			return NullID, errors.Errorf(
				"Cannot make a private TLF for a public team ID %s", tid)
		}
		idBytes[idByteLen-1] = idSuffix
	case Public:
		if !tid.IsPublic() {
			return NullID, errors.Errorf(
				"Cannot make a public TLF for a private team ID %s", tid)
		}
		idBytes[idByteLen-1] = pubIDSuffix
	case SingleTeam:
		if tid.IsPublic() {
			return NullID, errors.Errorf(
				"Cannot make a single-team TLF for a public team ID %s", tid)
		}
		idBytes[idByteLen-1] = singleTeamIDSuffix
	default:
		panic(fmt.Sprintf("Unknown TLF type %d", t))
	}
	var id ID
	err := id.UnmarshalBinary(idBytes)
	if err != nil {
		return NullID, err
	}
	return id, nil
}

// GetEpochFromTeamTLF returns 1) whether this ID matches the given
// team TID, and 2) if so, which epoch it is.
func (id ID) GetEpochFromTeamTLF(tid keybase1.TeamID) (
	matches bool, epoch byte, err error) {
	tidBytes := tid.ToBytes()
	if len(tidBytes) != idByteLen {
		return false, 0, errors.Errorf(
			"The length of team ID %s doesn't match that of a TLF ID", tid)
	}

	epochIndex := idByteLen - 2
	if !bytes.Equal(tidBytes[:epochIndex], id.id[:epochIndex]) {
		return false, 0, nil
	}

	return true, id.id[epochIndex], nil
}
