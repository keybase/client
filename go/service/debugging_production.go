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

func (t *DebuggingHandler) Script(ctx context.Context, arg keybase1.ScriptArg) (_ string, err error) {
	defer t.G().CTraceTimed(ctx, "Script", func() error { return err })()
	return "", fmt.Errorf("debugging script not supported in production builds")
}
