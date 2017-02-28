// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type tlfHandler struct {
	*BaseHandler
	utils.DebugLabeler
	libkb.Contextified
}

func newTlfHandler(xp rpc.Transporter, g *libkb.GlobalContext) *tlfHandler {
	return &tlfHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "TlfHandler", false),
	}
}

func (h *tlfHandler) tlfKeysClient() (*keybase1.TlfKeysClient, error) {
	xp := h.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, fmt.Errorf("KBFS client wasn't found")
	}
	return &keybase1.TlfKeysClient{
		Cli: rpc.NewClient(xp, libkb.ErrorUnwrapper{}),
	}, nil
}

func appendBreaks(l []keybase1.TLFIdentifyFailure, r []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
	m := make(map[string]bool)
	var res []keybase1.TLFIdentifyFailure
	for _, f := range l {
		m[f.User.Username] = true
		res = append(res, f)
	}
	for _, f := range r {
		if !m[f.User.Username] {
			res = append(res, f)
		}
	}
	return res
}

func (h *tlfHandler) CryptKeys(ctx context.Context, arg keybase1.TLFQuery) (keybase1.GetTLFCryptKeysRes, error) {
	var err error
	ident, breaks, ok := chat.IdentifyMode(ctx)
	if ok {
		arg.IdentifyBehavior = ident
	}
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("CryptKeys(tlf=%s,mode=%v,handler=%v)", arg.TlfName, arg.IdentifyBehavior, h.BaseHandler.xp != nil))()

	tlfClient, err := h.tlfKeysClient()
	if err != nil {
		return keybase1.GetTLFCryptKeysRes{}, err
	}

	resp, err := tlfClient.GetTLFCryptKeys(ctx, arg)
	if err != nil {
		return resp, err
	}

	if in := chat.CtxIdentifyNotifier(ctx); in != nil {
		in.Send(resp.NameIDBreaks)
	}
	if ok {
		*breaks = appendBreaks(*breaks, resp.NameIDBreaks.Breaks.Breaks)
	}
	return resp, nil
}

func (h *tlfHandler) PublicCanonicalTLFNameAndID(ctx context.Context, arg keybase1.TLFQuery) (keybase1.CanonicalTLFNameAndIDWithBreaks, error) {
	var err error
	ident, breaks, ok := chat.IdentifyMode(ctx)
	if ok {
		arg.IdentifyBehavior = ident
	}
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("PublicCanonicalTLFNameAndID(tlf=%s,mode=%v)", arg.TlfName,
			arg.IdentifyBehavior))()

	tlfClient, err := h.tlfKeysClient()
	if err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	resp, err := tlfClient.GetPublicCanonicalTLFNameAndID(ctx, arg)
	if err != nil {
		return resp, err
	}

	if in := chat.CtxIdentifyNotifier(ctx); in != nil {
		in.Send(resp)
	}
	if ok {
		*breaks = appendBreaks(*breaks, resp.Breaks.Breaks)
	}
	return resp, nil
}

func (h *tlfHandler) CompleteAndCanonicalizePrivateTlfName(ctx context.Context, arg keybase1.TLFQuery) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
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
