// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"encoding"
	"encoding/hex"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfshash"
	"github.com/pkg/errors"
)

// ID is the content-based ID for a metadata block.
type ID struct {
	h kbfshash.Hash
}

var _ encoding.BinaryMarshaler = ID{}
var _ encoding.BinaryUnmarshaler = (*ID)(nil)

var _ encoding.TextMarshaler = ID{}
var _ encoding.TextUnmarshaler = (*ID)(nil)

// MakeID creates a new ID from the given RootMetadata object.
func MakeID(codec kbfscodec.Codec, md RootMetadata) (ID, error) {
	// Make sure that the serialized metadata is set; otherwise we
	// won't get the right ID.
	if md.GetSerializedPrivateMetadata() == nil {
		return ID{}, errors.WithStack(MissingDataError{md.TlfID()})
	}

	buf, err := codec.Encode(md)
	if err != nil {
		return ID{}, err
	}

	h, err := kbfshash.DefaultHash(buf)
	if err != nil {
		return ID{}, err
	}

	return ID{h}, nil
}

// FakeID returns an ID derived from the given byte, suitable for
// testing.
func FakeID(b byte) ID {
	dh := kbfshash.RawDefaultHash{b}
	h, err := kbfshash.HashFromRaw(kbfshash.DefaultHashType, dh[:])
	if err != nil {
		panic(err)
	}
	return ID{h}
}

// Bytes returns the bytes of the MDID.
func (id ID) Bytes() []byte {
	return id.h.Bytes()
}

func (id ID) String() string {
	return id.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// ID. Returns an error if the ID is invalid and not the zero
// ID.
func (id ID) MarshalBinary() (data []byte, err error) {
	return id.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for ID. Returns an error if the given byte array is non-empty and
// the ID is invalid.
func (id *ID) UnmarshalBinary(data []byte) error {
	return id.h.UnmarshalBinary(data)
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

// ParseID parses a hex encoded ID. Returns ID{} and an InvalidIDError
// on failure.
func ParseID(s string) (ID, error) {
	var id ID
	err := id.UnmarshalText([]byte(s))
	if err != nil {
		return ID{}, err
	}
	return id, nil
}
