// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
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

func (h *tlfHandler) CryptKeys(ctx context.Context, tlfName string) (keybase1.TLFCryptKeys, error) {
	tlfClient, err := h.tlfKeysClient()
	if err != nil {
		return keybase1.TLFCryptKeys{}, err
	}
	return tlfClient.GetTLFCryptKeys(ctx, tlfName)
}
