// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type tlfHandler struct {
	*BaseHandler
	utils.DebugLabeler
	globals.Contextified

	tlfInfoSource types.TLFInfoSource
}

func newTlfHandler(xp rpc.Transporter, g *globals.Context) *tlfHandler {
	return &tlfHandler{
		BaseHandler:   NewBaseHandler(xp),
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g, "TlfHandler", false),
		tlfInfoSource: chat.NewKBFSTLFInfoSource(g),
	}
}

func (h *tlfHandler) CryptKeys(ctx context.Context, arg keybase1.TLFQuery) (res keybase1.GetTLFCryptKeysRes, err error) {
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("CryptKeys(tlf=%s,mode=%v)", arg.TlfName, arg.IdentifyBehavior))()
	var breaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &breaks, chat.NewIdentifyNotifier(h.G()))
	return h.tlfInfoSource.CryptKeys(ctx, arg.TlfName)
}

func (h *tlfHandler) PublicCanonicalTLFNameAndID(ctx context.Context, arg keybase1.TLFQuery) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("PublicCanonicalTLFNameAndID(tlf=%s,mode=%v)", arg.TlfName,
			arg.IdentifyBehavior))()
	var breaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &breaks, chat.NewIdentifyNotifier(h.G()))
	return h.tlfInfoSource.PublicCanonicalTLFNameAndID(ctx, arg.TlfName)
}

func (h *tlfHandler) CompleteAndCanonicalizePrivateTlfName(ctx context.Context, arg keybase1.TLFQuery) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("CompleteAndCanonicalizePrivateTlfName(tlf=%s,mode=%v)", arg.TlfName,
			arg.IdentifyBehavior))()
	var breaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &breaks, chat.NewIdentifyNotifier(h.G()))
	return h.tlfInfoSource.CompleteAndCanonicalizePrivateTlfName(ctx, arg.TlfName)
}
