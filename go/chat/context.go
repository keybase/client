// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package chat

import (
	"github.com/jonboulle/clockwork"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

// KeybaseContext defines what chat needs from Keybase
type KeybaseContext interface {
	GetLog() logger.Logger
	LoadUser(uid keybase1.UID) (*libkb.User, error)
	Clock() clockwork.Clock
}
