// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"context"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
)

// EmptyKeyMetadata stores only the TLF ID and KeyGen, and no-ops the
// other methods of the `libkey.KeyMetadata` interface.  This is
// useful for testing.
type EmptyKeyMetadata struct {
	tlfID  tlf.ID
	keyGen kbfsmd.KeyGen
}

var _ libkey.KeyMetadata = EmptyKeyMetadata{}

// NewEmptyKeyMetadata creates a new `EmptyKeyMetadata` instance.
func NewEmptyKeyMetadata(tlfID tlf.ID, keyGen kbfsmd.KeyGen) EmptyKeyMetadata {
	return EmptyKeyMetadata{tlfID, keyGen}
}

// TlfID implements the `libkey.KeyMetadata` interface for EmptyKeyMetadata.
func (kmd EmptyKeyMetadata) TlfID() tlf.ID {
	return kmd.tlfID
}

// TypeForKeying implements the `libkey.KeyMetadata` interface for
// EmptyKeyMetadata.
func (kmd EmptyKeyMetadata) TypeForKeying() tlf.KeyingType {
	return kmd.TlfID().Type().ToKeyingType()
}

// GetTlfHandle just returns nil. This contradicts the requirements
// for KeyMetadata, but EmptyKeyMetadata shouldn't be used in contexts
// that actually use GetTlfHandle().
func (kmd EmptyKeyMetadata) GetTlfHandle() *tlfhandle.Handle {
	return nil
}

// IsWriter no-ops the `libkey.KeyMetadata` interface for EmptyKeyMetadata.
func (kmd EmptyKeyMetadata) IsWriter(
	_ context.Context, _ kbfsmd.TeamMembershipChecker, _ idutil.OfflineStatusGetter,
	_ keybase1.UID, _ kbfscrypto.VerifyingKey) (bool, error) {
	return false, nil
}

// LatestKeyGeneration implements the `libkey.KeyMetadata` interface
// for EmptyKeyMetadata.
func (kmd EmptyKeyMetadata) LatestKeyGeneration() kbfsmd.KeyGen {
	return kmd.keyGen
}

// HasKeyForUser no-ops the `libkey.KeyMetadata` interface for
// EmptyKeyMetadata.
func (kmd EmptyKeyMetadata) HasKeyForUser(user keybase1.UID) (bool, error) {
	return false, nil
}

// GetTLFCryptKeyParams no-ops the `libkey.KeyMetadata` interface for
// EmptyKeyMetadata.
func (kmd EmptyKeyMetadata) GetTLFCryptKeyParams(
	keyGen kbfsmd.KeyGen, user keybase1.UID, key kbfscrypto.CryptPublicKey) (
	kbfscrypto.TLFEphemeralPublicKey, kbfscrypto.EncryptedTLFCryptKeyClientHalf,
	kbfscrypto.TLFCryptKeyServerHalfID, bool, error) {
	return kbfscrypto.TLFEphemeralPublicKey{},
		kbfscrypto.EncryptedTLFCryptKeyClientHalf{},
		kbfscrypto.TLFCryptKeyServerHalfID{}, false, nil
}

// StoresHistoricTLFCryptKeys no-ops the `libkey.KeyMetadata`
// interface for EmptyKeyMetadata.
func (kmd EmptyKeyMetadata) StoresHistoricTLFCryptKeys() bool {
	return false
}

// GetHistoricTLFCryptKey no-ops the `libkey.KeyMetadata` interface
// for EmptyKeyMetadata.
func (kmd EmptyKeyMetadata) GetHistoricTLFCryptKey(
	codec kbfscodec.Codec, keyGen kbfsmd.KeyGen, key kbfscrypto.TLFCryptKey) (
	kbfscrypto.TLFCryptKey, error) {
	return kbfscrypto.TLFCryptKey{}, nil
}
