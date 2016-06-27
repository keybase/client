// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type fsHandler struct {
	*BaseHandler
	libkb.Contextified
}

func newFSHandler(xp rpc.Transporter, g *libkb.GlobalContext) *fsHandler {
	return &fsHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *fsHandler) fsClient() (*keybase1.FsClient, error) {
	xp := h.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, fmt.Errorf("KBFS client wasn't found")
	}
	return &keybase1.FsClient{
		Cli: rpc.NewClient(*xp, libkb.ErrorUnwrapper{}),
	}, nil
}

func (h *fsHandler) List(_ context.Context, arg keybase1.ListArg) (keybase1.ListResult, error) {
	fsClient, err := h.fsClient()
	if err != nil {
		return keybase1.ListResult{}, err
	}
	return fsClient.List(context.TODO(), arg)
}
