// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"strconv"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type DebuggingHandler struct {
	libkb.Contextified
	*BaseHandler
	userHandler   *UserHandler
	walletHandler *walletHandler
}

func NewDebuggingHandler(xp rpc.Transporter, g *libkb.GlobalContext, userHandler *UserHandler, walletHandler *walletHandler) *DebuggingHandler {
	return &DebuggingHandler{
		Contextified:  libkb.NewContextified(g),
		BaseHandler:   NewBaseHandler(g, xp),
		userHandler:   userHandler,
		walletHandler: walletHandler,
	}
}

// See debugging_devel.go for additional scripts.
func (t *DebuggingHandler) Script(ctx context.Context, arg keybase1.ScriptArg) (res string, err error) {
	ctx = libkb.WithLogTag(ctx, "DG")
	m := libkb.NewMetaContext(ctx, t.G())
	defer m.TraceTimed(fmt.Sprintf("Script(%s)", arg.Script), func() error { return err })()
	args := arg.Args
	log := func(format string, args ...interface{}) {
		t.G().Log.CInfof(ctx, format, args...)
	}
	defer time.Sleep(100 * time.Millisecond) // Without this CInfof often doesn't reach the CLI
	switch arg.Script {
	case "journeycard":
		log("journeycard-fastforward [days]")
		log("journeycard-resetall")
		log("journeycard-state <conv-id>")
		return "", nil
	case "journeycard-fastforward":
		uidGregor := gregor1.UID(m.G().ActiveDevice.UID().ToBytes())
		advance := 24 * time.Hour
		if len(args) >= 1 {
			days, err := strconv.Atoi(args[0])
			if err != nil {
				return "", err
			}
			advance = time.Duration(days) * 24 * time.Hour
		}
		err = t.G().ChatHelper.JourneycardTimeTravel(m.Ctx(), uidGregor, advance)
		if err != nil {
			return "", err
		}
		log("time advanced by %v for all convs", advance)
		return "", err
	case "journeycard-resetall":
		uidGregor := gregor1.UID(m.G().ActiveDevice.UID().ToBytes())
		err = t.G().ChatHelper.JourneycardResetAllConvs(m.Ctx(), uidGregor)
		if err != nil {
			return "", err
		}
		log("journeycard state has been reset for all convs")
		return "", nil
	case "journeycard-state":
		if len(args) != 1 {
			return "", fmt.Errorf("usage: journeycard-state <conv-id> (like 000059aa7f324dad7524b56ed1beb3e3d620b3897d640951710f1417c6b7b85f)")
		}
		convID, err := chat1.MakeConvID(args[0])
		if err != nil {
			return "", err
		}
		uidGregor := gregor1.UID(m.G().ActiveDevice.UID().ToBytes())
		summary, err := t.G().ChatHelper.JourneycardDebugState(m.Ctx(), uidGregor, convID)
		return summary, err
	case "":
		return "", fmt.Errorf("empty script name")
	default:
		return t.scriptExtras(ctx, arg)
	}
}

func (t *DebuggingHandler) FirstStep(ctx context.Context, arg keybase1.FirstStepArg) (result keybase1.FirstStepResult, err error) {
	client := t.rpcClient()
	cbArg := keybase1.SecondStepArg{Val: arg.Val + 1, SessionID: arg.SessionID}
	var cbReply int
	err = client.Call(ctx, "keybase.1.debugging.secondStep", []interface{}{cbArg}, &cbReply, 0)
	if err != nil {
		return
	}

	result.ValPlusTwo = cbReply
	return
}

func (t *DebuggingHandler) SecondStep(_ context.Context, arg keybase1.SecondStepArg) (val int, err error) {
	val = arg.Val + 1
	return
}

func (t *DebuggingHandler) Increment(_ context.Context, arg keybase1.IncrementArg) (val int, err error) {
	val = arg.Val + 1
	return
}
