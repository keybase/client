// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type tlfHandler struct {
	*BaseHandler
	libkb.Contextified
}

func newTlfHandler(xp rpc.Transporter, g *libkb.GlobalContext) *tlfHandler {
	return &tlfHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *tlfHandler) tlfKeysClient() (*keybase1.TlfKeysClient, error) {
	xp := h.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, fmt.Errorf("KBFS client wasn't found")
	}
	return &keybase1.TlfKeysClient{
		Cli: rpc.NewClient(*xp, libkb.ErrorUnwrapper{}),
	}, nil
}

func (h *tlfHandler) CryptKeys(ctx context.Context, arg keybase1.CryptKeysArg) (keybase1.GetTLFCryptKeysRes, error) {
	tlfClient, err := h.tlfKeysClient()
	if err != nil {
		return keybase1.GetTLFCryptKeysRes{}, err
	}
	return tlfClient.GetTLFCryptKeys(ctx, keybase1.GetTLFCryptKeysArg{
		TlfName:          arg.TlfName,
		IdentifyBehavior: arg.IdentifyBehavior,
	})
}

func (h *tlfHandler) PublicCanonicalTLFNameAndID(ctx context.Context, arg keybase1.PublicCanonicalTLFNameAndIDArg) (keybase1.CanonicalTLFNameAndIDWithBreaks, error) {
	tlfClient, err := h.tlfKeysClient()
	if err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}
	return tlfClient.GetPublicCanonicalTLFNameAndID(ctx, keybase1.GetPublicCanonicalTLFNameAndIDArg{
		TlfName:          arg.TlfName,
		IdentifyBehavior: arg.IdentifyBehavior,
	})
}

func (h *tlfHandler) CompleteAndCanonicalizeTlfName(ctx context.Context, arg keybase1.CompleteAndCanonicalizeTlfNameArg) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
	username := h.G().Env.GetUsername()
	if len(username) == 0 {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, libkb.InvalidArgumentError{Msg: "Username is empty. Are you logged in?"}
	}

	// Append username in case it's not present. We don't need to check if it
	// exists already since CryptKeys calls below transforms the TLF name into a
	// canonical one.
	arg.TlfName = arg.TlfName + "," + string(username)

	// TODO: do some caching so we don't end up calling this RPC
	// unnecessarily too often
	resp, err := h.CryptKeys(ctx, keybase1.CryptKeysArg{
		TlfName:          arg.TlfName,
		IdentifyBehavior: arg.IdentifyBehavior,
	})
	if err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	return keybase1.CanonicalTLFNameAndIDWithBreaks{
		Breaks:        resp.Breaks,
		CanonicalName: resp.CanonicalName,
		TlfID:         resp.TlfID,
	}, nil
}
