// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package idutil

import (
	"context"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// GetCurrentSessionIfPossible returns the current username and UID
// from kbpki.GetCurrentSession.  If sessionNotRequired is true
// NoCurrentSessionError is ignored and empty username and uid will be
// returned. If it is false all errors are returned.
func GetCurrentSessionIfPossible(
	ctx context.Context, kbpki CurrentSessionGetter, sessionNotRequired bool) (
	SessionInfo, error) {
	session, err := kbpki.GetCurrentSession(ctx)
	if err == nil {
		return session, nil
	}
	// Return all errors if a session is required.
	if !sessionNotRequired {
		return SessionInfo{}, err
	}

	// If not logged in, return empty session.
	if _, notLoggedIn := err.(NoCurrentSessionError); notLoggedIn {
		return SessionInfo{}, nil
	}

	// Otherwise, just return the error.
	return SessionInfo{}, err
}

// SessionInfoFromProtocol returns SessionInfo from Session
func SessionInfoFromProtocol(session keybase1.Session) (SessionInfo, error) {
	// Import the KIDs to validate them.
	deviceSubkey, err := libkb.ImportKeypairFromKID(session.DeviceSubkeyKid)
	if err != nil {
		return SessionInfo{}, err
	}
	deviceSibkey, err := libkb.ImportKeypairFromKID(session.DeviceSibkeyKid)
	if err != nil {
		return SessionInfo{}, err
	}
	cryptPublicKey := kbfscrypto.MakeCryptPublicKey(deviceSubkey.GetKID())
	verifyingKey := kbfscrypto.MakeVerifyingKey(deviceSibkey.GetKID())
	return SessionInfo{
		Name:           kbname.NewNormalizedUsername(session.Username),
		UID:            session.Uid,
		CryptPublicKey: cryptPublicKey,
		VerifyingKey:   verifyingKey,
	}, nil
}
