// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package utils

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

// KeybaseContext defines what chat needs from Keybase
type KeybaseContext interface {
	GetLog() logger.Logger
	LoadUserByUID(uid keybase1.UID) (*libkb.User, error)
	UIDToUsername(uid keybase1.UID) (libkb.NormalizedUsername, error)
	Clock() clockwork.Clock
	GetCachedUserLoader() *libkb.CachedUserLoader
	GetUserDeviceCache() *libkb.UserDeviceCache
	GetMerkleClient() *libkb.MerkleClient
}
