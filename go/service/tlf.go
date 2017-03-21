// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type tlfHandler struct {
	*BaseHandler
	utils.DebugLabeler
	libkb.Contextified

	tlfInfoSource types.TLFInfoSource
}

func newTlfHandler(xp rpc.Transporter, g *libkb.GlobalContext) *tlfHandler {
	return &tlfHandler{
		BaseHandler:   NewBaseHandler(xp),
		Contextified:  libkb.NewContextified(g),
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
<<<<<<< HEAD
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("CompleteAndCanonicalizePrivateTlfName(tlf=%s,mode=%v)", arg.TlfName,
			arg.IdentifyBehavior))()
	var breaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &breaks, chat.NewIdentifyNotifier(h.G()))
	return h.tlfInfoSource.CompleteAndCanonicalizePrivateTlfName(ctx, arg.TlfName)
=======
	username := h.G().Env.GetUsername()
	if len(username) == 0 {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, libkb.LoginRequiredError{}
	}

	// Prepend username in case it's not present. We don't need to check if it
	// exists already since CryptKeys calls below transforms the TLF name into a
	// canonical one.
	//
	// This makes username a writer on this TLF, which might be unexpected.
	// TODO: We should think about how to handle read-only TLFs.
	arg.TlfName = string(username) + "," + arg.TlfName

	// TODO: do some caching so we don't end up calling this RPC
	// unnecessarily too often
	resp, err := h.CryptKeys(ctx, arg)
	if err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	return resp.NameIDBreaks, nil
}

func (h *tlfHandler) identifyTLF(ctx context.Context, arg keybase1.TLFQuery, private bool) ([]keybase1.TLFIdentifyFailure, error) {
	var fails []keybase1.TLFIdentifyFailure
	pieces := strings.Split(arg.TlfName, ",")
	for _, p := range pieces {
		f, err := h.identifyUser(ctx, p, private, arg.IdentifyBehavior)
		if err != nil {
			return nil, err
		}
		fails = append(fails, f)
	}
	return fails, nil
}

func (h *tlfHandler) identifyUser(ctx context.Context, assertion string, private bool, idBehavior keybase1.TLFIdentifyBehavior) (keybase1.TLFIdentifyFailure, error) {
	reason := "You accessed a public conversation."
	if private {
		reason = fmt.Sprintf("You accessed a private conversation with %s.", assertion)
	}

	arg := keybase1.Identify2Arg{
		UserAssertion:    assertion,
		UseDelegateUI:    true,
		Reason:           keybase1.IdentifyReason{Reason: reason},
		CanSuppressUI:    true,
		IdentifyBehavior: idBehavior,
	}

	// no sessionID as this can be called anywhere, not just as a client action
	sessionID := 0
	ectx := engine.Context{
		LogUI:      h.getLogUI(sessionID),
		IdentifyUI: h.NewRemoteIdentifyUI(sessionID, h.G()),
		SessionID:  sessionID,
		NetContext: ctx,
	}

	eng := engine.NewResolveThenIdentify2(h.G(), &arg)
	err := engine.RunEngine(eng, &ectx)
	if err != nil {
		return keybase1.TLFIdentifyFailure{}, err
	}
	resp := eng.Result()

	var frep keybase1.TLFIdentifyFailure
	if resp != nil {
		frep.User = keybase1.User{
			Uid:      resp.Upk.Uid,
			Username: resp.Upk.Username,
		}
		frep.Breaks = resp.TrackBreaks
	}

	return frep, nil
>>>>>>> c33db3128... WIP
}
