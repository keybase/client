// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
//go:build production
// +build production

package service

import (
	"context"
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func (t *DebuggingHandler) scriptExtras(ctx context.Context, arg keybase1.ScriptArg) (_ string, err error) {
	return "", fmt.Errorf("unknown script in production mode: %v", arg.Script)
}
