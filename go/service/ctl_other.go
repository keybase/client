// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package service

import (
	"errors"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func (c *CtlHandler) SetOnLoginStartup(_ context.Context, _ bool) error {
	return errors.New("SetOnLoginStartup not supported on this platform")
}

func (c *CtlHandler) GetOnLoginStartup(_ context.Context) (keybase1.OnLoginStartupStatus, error) {
	return keybase1.OnLoginStartupStatus_UNKNOWN, errors.New("GetOnLoginStartup not supported on this platform")
}
