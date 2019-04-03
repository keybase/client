// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func NewResetUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.ResetUIProtocol(g.UI.GetResetUI())
}

type ResetUI struct {
	libkb.Contextified
	terminal    libkb.TerminalUI
	interactive bool
	ignore      bool
}

func (r ResetUI) ResetPrompt(ctx context.Context, arg keybase1.ResetPromptArg) (keybase1.ResetPromptResult, error) {
	if arg.Reset {
		ret, err := r.terminal.PromptYesNo(0, arg.Text+" Would you like to reset?", libkb.PromptDefaultNeither)
		if err != nil {
			return keybase1.ResetPromptResult_IGNORE, err
		}
		if ret {
			return keybase1.ResetPromptResult_RESET, nil
		}
	}

	ret, err := r.terminal.PromptYesNo(0, arg.Text+" Would you like to cancel?", libkb.PromptDefaultNeither)
	if err != nil {
		return keybase1.ResetPromptResult_IGNORE, err
	}
	if ret {
		return keybase1.ResetPromptResult_CANCEL, nil
	}

	return keybase1.ResetPromptResult_IGNORE, nil
}
