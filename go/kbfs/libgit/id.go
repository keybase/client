// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"encoding"
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/pkg/errors"
)

const (
	// idByteLen is the number of bytes in a git repo ID.
	idByteLen = 16

	idSuffix = 0x2c
)

// InvalidIDError indicates that a repo ID string is not parseable or
// invalid.
type InvalidIDError struct {
	id string
}

func (e InvalidIDError) Error() string {
	return fmt.Sprintf("Invalid repo ID %q", e.id)
}

// ID encapsulates a repo ID.
type ID struct {
	id [idByteLen]byte
}

var _ encoding.BinaryMarshaler = ID{}
var _ encoding.BinaryUnmarshaler = (*ID)(nil)

var _ encoding.TextMarshaler = ID{}
var _ encoding.TextUnmarshaler = (*ID)(nil)

// NullID is an empty ID
var NullID = ID{}

// Bytes returns the bytes of the ID.
func (id ID) Bytes() []byte {
	return id.id[:]
}

// String implements the Stringer interface for ID.
func (id ID) String() string {
	return hex.EncodeToString(id.id[:])
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for ID.
func (id ID) MarshalBinary() (data []byte, err error) {
	suffix := id.id[idByteLen-1]
	if suffix != idSuffix {
		return nil, errors.WithStack(InvalidIDError{id.String()})
	}
	return id.id[:], nil
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for ID.
func (id *ID) UnmarshalBinary(data []byte) error {
	if len(data) != idByteLen {
		return errors.WithStack(InvalidIDError{hex.EncodeToString(data)})
	}
	suffix := data[idByteLen-1]
	if suffix != idSuffix {
		return errors.WithStack(InvalidIDError{hex.EncodeToString(data)})
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

func makeRandomID() (id ID, err error) {
	// Loop just in case we randomly pick the null ID.
	for id == NullID {
		err := kbfscrypto.RandRead(id.id[:idByteLen-1])
		if err != nil {
			return ID{}, err
		}
	}
	id.id[idByteLen-1] = idSuffix
	return id, nil
}
