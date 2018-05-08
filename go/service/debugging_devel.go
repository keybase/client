// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build !production

package service

import (
	"fmt"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func (t *DebuggingHandler) Script(ctx context.Context, arg keybase1.ScriptArg) (res string, err error) {
	ctx = libkb.WithLogTag(ctx, "DG")
	m := libkb.NewMetaContext(ctx, t.G())
	defer m.CTraceTimed(fmt.Sprintf("Script(%s)", arg.Script), func() error { return err })()
	args := arg.Args
	log := func(format string, args ...interface{}) {
		t.G().Log.CInfof(ctx, format, args...)
	}
	defer time.Sleep(100 * time.Millisecond) // Without this CInfof often doesn't reach the CLI
	switch arg.Script {
	case "rid2":
		if len(args) != 2 {
			return "", fmt.Errorf("require 2 args: <mode:gui/kbfs> <assertion>")
		}
		idBehavior := keybase1.TLFIdentifyBehavior_CHAT_GUI
		var iui libkb.IdentifyUI
		switch args[0] {
		case "gui":
		case "kbfs":
			idBehavior = keybase1.TLFIdentifyBehavior_CHAT_GUI
			iui = t.NewRemoteIdentifyUI(0)
		default:
			return "", fmt.Errorf("unrecognized mode %v: use 'gui' or 'kbfs'", args[0])
		}
		eng := engine.NewResolveThenIdentify2(t.G(), &keybase1.Identify2Arg{
			UserAssertion:    args[1],
			UseDelegateUI:    false,
			Reason:           keybase1.IdentifyReason{Reason: "debugging script"},
			CanSuppressUI:    true,
			IdentifyBehavior: idBehavior,
		})
		m = m.WithUIs(libkb.UIs{IdentifyUI: iui})
		err := engine.RunEngine2(m, eng)
		log("GetProofSet: %v", spew.Sdump(eng.GetProofSet()))
		log("ConfirmResult: %v", spew.Sdump(eng.ConfirmResult()))
		eres := eng.Result()
		if eres != nil {
			log("Result.Upk.Username: %v", spew.Sdump(eres.Upk.Username))
			log("Result.IdentifiedAt: %v", spew.Sdump(eres.IdentifiedAt))
			log("Result.TrackBreaks: %v", spew.Sdump(eres.TrackBreaks))
		} else {
			log("Result: %v", spew.Sdump(eres))
		}
		return "", err
	case "":
		return "", fmt.Errorf("empty script name")
	default:
		return "", fmt.Errorf("unknown script: %v", arg.Script)
	}
}

func (t *DebuggingHandler) NewRemoteIdentifyUI(sessionID int) *RemoteIdentifyUI {
	c := t.rpcClient()
	return &RemoteIdentifyUI{
		sessionID:    sessionID,
		uicli:        keybase1.IdentifyUiClient{Cli: c},
		logUI:        t.getLogUI(sessionID),
		Contextified: libkb.NewContextified(t.G()),
	}
}
