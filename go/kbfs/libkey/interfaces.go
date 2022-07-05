// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkey

import (
	"context"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
)

// KeyOps fetches server-side key halves from the key server.
type KeyOps interface {
	// GetTLFCryptKeyServerHalf gets a server-side key half for a
	// device given the key half ID.
	GetTLFCryptKeyServerHalf(ctx context.Context,
		serverHalfID kbfscrypto.TLFCryptKeyServerHalfID,
		cryptPublicKey kbfscrypto.CryptPublicKey) (
		kbfscrypto.TLFCryptKeyServerHalf, error)

	// PutTLFCryptKeyServerHalves stores a server-side key halves for a
	// set of users and devices.
	PutTLFCryptKeyServerHalves(ctx context.Context,
		keyServerHalves kbfsmd.UserDeviceKeyServerHalves) error

	// DeleteTLFCryptKeyServerHalf deletes a server-side key half for a
	// device given the key half ID.
	DeleteTLFCryptKeyServerHalf(ctx context.Context,
		uid keybase1.UID, key kbfscrypto.CryptPublicKey,
		serverHalfID kbfscrypto.TLFCryptKeyServerHalfID) error
}

// KeyServer fetches/writes server-side key halves from/to the key server.
type KeyServer interface {
	// GetTLFCryptKeyServerHalf gets a server-side key half for a
	// device given the key half ID.
	GetTLFCryptKeyServerHalf(ctx context.Context,
		serverHalfID kbfscrypto.TLFCryptKeyServerHalfID,
		cryptPublicKey kbfscrypto.CryptPublicKey) (
		kbfscrypto.TLFCryptKeyServerHalf, error)

	// PutTLFCryptKeyServerHalves stores a server-side key halves for a
	// set of users and devices.
	PutTLFCryptKeyServerHalves(ctx context.Context,
		keyServerHalves kbfsmd.UserDeviceKeyServerHalves) error

	// DeleteTLFCryptKeyServerHalf deletes a server-side key half for a
	// device given the key half ID.
	DeleteTLFCryptKeyServerHalf(ctx context.Context,
		uid keybase1.UID, key kbfscrypto.CryptPublicKey,
		serverHalfID kbfscrypto.TLFCryptKeyServerHalfID) error

	// Shutdown is called to free any KeyServer resources.
	Shutdown()
}

// KeyMetadata is an interface for something that holds key
// information. This is usually implemented by RootMetadata.
type KeyMetadata interface {
	// TlfID returns the ID of the TLF for which this object holds
	// key info.
	TlfID() tlf.ID

	// TypeForKeying returns the keying type for this MD.
	TypeForKeying() tlf.KeyingType

	// LatestKeyGeneration returns the most recent key generation
	// with key data in this object, or PublicKeyGen if this TLF
	// is public.
	LatestKeyGeneration() kbfsmd.KeyGen

	// GetTlfHandle returns the handle for the TLF. It must not
	// return nil.
	//
	// TODO: Remove the need for this function in this interface,
	// so that kbfsmd.RootMetadata can implement this interface
	// fully.
	GetTlfHandle() *tlfhandle.Handle

	// IsWriter checks that the given user is a valid writer of the TLF
	// right now.
	IsWriter(
		ctx context.Context, checker kbfsmd.TeamMembershipChecker,
		osg idutil.OfflineStatusGetter, uid keybase1.UID,
		verifyingKey kbfscrypto.VerifyingKey) (bool, error)

	// HasKeyForUser returns whether or not the given user has
	// keys for at least one device. Returns an error if the TLF
	// is public.
	HasKeyForUser(user keybase1.UID) (bool, error)

	// GetTLFCryptKeyParams returns all the necessary info to
	// construct the TLF crypt key for the given key generation,
	// user, and device (identified by its crypt public key), or
	// false if not found. This returns an error if the TLF is
	// public.
	GetTLFCryptKeyParams(
		keyGen kbfsmd.KeyGen, user keybase1.UID,
		key kbfscrypto.CryptPublicKey) (
		kbfscrypto.TLFEphemeralPublicKey,
		kbfscrypto.EncryptedTLFCryptKeyClientHalf,
		kbfscrypto.TLFCryptKeyServerHalfID, bool, error)

	// StoresHistoricTLFCryptKeys returns whether or not history keys are
	// symmetrically encrypted; if not, they're encrypted per-device.
	StoresHistoricTLFCryptKeys() bool

	// GetHistoricTLFCryptKey attempts to symmetrically decrypt the
	// key at the given generation using the current generation's
	// TLFCryptKey.
	GetHistoricTLFCryptKey(codec kbfscodec.Codec, keyGen kbfsmd.KeyGen,
		currentKey kbfscrypto.TLFCryptKey) (
		kbfscrypto.TLFCryptKey, error)
}
