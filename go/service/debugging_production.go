// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build production

package service

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func (t *DebuggingHandler) scriptExtras(ctx context.Context, arg keybase1.ScriptArg) (_ string, err error) {
	return "", fmt.Errorf("unknown script in production mode: %v", arg.Script)
}
