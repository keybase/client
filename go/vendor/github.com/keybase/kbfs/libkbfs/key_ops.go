// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"golang.org/x/net/context"
)

// KeyOpsStandard implements the KeyOps interface and relays get/put
// requests for server-side key halves from/to the key server.
type KeyOpsStandard struct {
	config Config
}

// Test that KeyOps standard fully implements the KeyOps interface.
var _ KeyOps = (*KeyOpsStandard)(nil)

// GetTLFCryptKeyServerHalf is an implementation of the KeyOps interface.
func (k *KeyOpsStandard) GetTLFCryptKeyServerHalf(ctx context.Context,
	serverHalfID kbfscrypto.TLFCryptKeyServerHalfID, key kbfscrypto.CryptPublicKey) (
	kbfscrypto.TLFCryptKeyServerHalf, error) {
	// get the key half from the server
	serverHalf, err := k.config.KeyServer().GetTLFCryptKeyServerHalf(ctx, serverHalfID, key)
	if err != nil {
		return kbfscrypto.TLFCryptKeyServerHalf{}, err
	}
	// get current uid and deviceKID
	session, err := k.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return kbfscrypto.TLFCryptKeyServerHalf{}, err
	}

	// verify we got the expected key
	err = kbfscrypto.VerifyTLFCryptKeyServerHalfID(serverHalfID, session.UID, key, serverHalf)
	if err != nil {
		return kbfscrypto.TLFCryptKeyServerHalf{}, err
	}
	return serverHalf, nil
}

// PutTLFCryptKeyServerHalves is an implementation of the KeyOps interface.
func (k *KeyOpsStandard) PutTLFCryptKeyServerHalves(ctx context.Context,
	keyServerHalves kbfsmd.UserDeviceKeyServerHalves) error {
	// upload the keys
	return k.config.KeyServer().PutTLFCryptKeyServerHalves(ctx, keyServerHalves)
}

// DeleteTLFCryptKeyServerHalf is an implementation of the KeyOps interface.
func (k *KeyOpsStandard) DeleteTLFCryptKeyServerHalf(ctx context.Context,
	uid keybase1.UID, key kbfscrypto.CryptPublicKey,
	serverHalfID kbfscrypto.TLFCryptKeyServerHalfID) error {
	return k.config.KeyServer().DeleteTLFCryptKeyServerHalf(
		ctx, uid, key, serverHalfID)
}
