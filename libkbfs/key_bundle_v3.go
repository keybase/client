// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

// TLFReaderKeyBundleV3 is an alias to a TLFReaderKeyBundleV2 for clarity.
type TLFReaderKeyBundleV3 struct {
	TLFReaderKeyBundleV2
}

// TLFWriterKeyBundleV3 is a bundle of writer keys and historic symmetric encryption
// keys for a top-level folder.
type TLFWriterKeyBundleV3 struct {
	// Maps from each user to their crypt key bundle for the current generation.
	Keys UserDeviceKeyInfoMap

	// M_e as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	// Because devices can be added into the key generation after it
	// is initially created (so those devices can get access to
	// existing data), we track multiple ephemeral public keys; the
	// one used by a particular device is specified by EPubKeyIndex in
	// its TLFCryptoKeyInfo struct.
	TLFEphemeralPublicKeys TLFEphemeralPublicKeys `codec:"ePubKey"`

	// M_f as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	TLFPublicKeys []TLFPublicKey `codec:"pubKey"`

	// This is a time-ordered encrypted list of historic key generations.
	// It is encrypted with the latest generation of the TLF crypt key.
	EncryptedHistoricTLFCryptKeys EncryptedTLFCryptKeys `codec:"oldKeys"`

	codec.UnknownFieldSetHandler
}

// IsWriter returns true if the given user device is in the device set.
func (wkb TLFWriterKeyBundleV3) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := wkb.Keys[user][deviceKID]
	return ok
}

// TLFReaderKeyBundleID is the hash of a serialized TLFReaderKeyBundle.
type TLFReaderKeyBundleID struct {
	h Hash
}

var _ encoding.BinaryMarshaler = TLFReaderKeyBundleID{}
var _ encoding.BinaryUnmarshaler = (*TLFReaderKeyBundleID)(nil)

// TLFReaderKeyBundleIDFromBytes creates a new TLFReaderKeyBundleID from the given bytes.
// If the returned error is nil, the returned TLFReaderKeyBundleID is valid.
func TLFReaderKeyBundleIDFromBytes(data []byte) (TLFReaderKeyBundleID, error) {
	h, err := HashFromBytes(data)
	if err != nil {
		return TLFReaderKeyBundleID{}, err
	}
	return TLFReaderKeyBundleID{h}, nil
}

// Bytes returns the bytes of the TLFReaderKeyBundleID.
func (h TLFReaderKeyBundleID) Bytes() []byte {
	return h.h.Bytes()
}

// String returns the string form of the TLFReaderKeyBundleID.
func (h TLFReaderKeyBundleID) String() string {
	return h.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// TLFReaderKeyBundleID. Returns an error if the TLFReaderKeyBundleID is invalid and not the
// zero TLFReaderKeyBundleID.
func (h TLFReaderKeyBundleID) MarshalBinary() (data []byte, err error) {
	return h.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for TLFReaderKeyBundleID. Returns an error if the given byte array is non-empty and
// the TLFReaderKeyBundleID is invalid.
func (h *TLFReaderKeyBundleID) UnmarshalBinary(data []byte) error {
	return h.h.UnmarshalBinary(data)
}

// TLFWriterKeyBundleID is the hash of a serialized TLFWriterKeyBundle.
type TLFWriterKeyBundleID struct {
	h Hash
}

var _ encoding.BinaryMarshaler = TLFWriterKeyBundleID{}
var _ encoding.BinaryUnmarshaler = (*TLFWriterKeyBundleID)(nil)

// TLFWriterKeyBundleIDFromBytes creates a new TLFWriterKeyBundleID from the given bytes.
// If the returned error is nil, the returned TLFWriterKeyBundleID is valid.
func TLFWriterKeyBundleIDFromBytes(data []byte) (TLFWriterKeyBundleID, error) {
	h, err := HashFromBytes(data)
	if err != nil {
		return TLFWriterKeyBundleID{}, err
	}
	return TLFWriterKeyBundleID{h}, nil
}

// Bytes returns the bytes of the TLFWriterKeyBundleID.
func (h TLFWriterKeyBundleID) Bytes() []byte {
	return h.h.Bytes()
}

// String returns the string form of the TLFWriterKeyBundleID.
func (h TLFWriterKeyBundleID) String() string {
	return h.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// TLFWriterKeyBundleID. Returns an error if the TLFWriterKeyBundleID is invalid and not the
// zero TLFWriterKeyBundleID.
func (h TLFWriterKeyBundleID) MarshalBinary() (data []byte, err error) {
	return h.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for TLFWriterKeyBundleID. Returns an error if the given byte array is non-empty and
// the TLFWriterKeyBundleID is invalid.
func (h *TLFWriterKeyBundleID) UnmarshalBinary(data []byte) error {
	return h.h.UnmarshalBinary(data)
}
