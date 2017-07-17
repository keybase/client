// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type notifyFSRequestHandler struct {
	*BaseHandler
	libkb.Contextified
}

func (h *notifyFSRequestHandler) client() (*keybase1.NotifyFSRequestClient, error) {
	xp := h.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, errors.New("KBFS client wasn't found")
	}
	return &keybase1.NotifyFSRequestClient{
		Cli: rpc.NewClient(xp, libkb.ErrorUnwrapper{}, nil),
	}, nil
}

func newNotifyFSRequestHandler(xp rpc.Transporter, g *libkb.GlobalContext) *notifyFSRequestHandler {
	return &notifyFSRequestHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *notifyFSRequestHandler) FSEditListRequest(ctx context.Context, arg keybase1.FSEditListRequest) error {
	cli, err := h.client()
	if err != nil {
		return err
	}
	return cli.FSEditListRequest(ctx, arg)
}

func (h *notifyFSRequestHandler) FSSyncStatusRequest(ctx context.Context, arg keybase1.FSSyncStatusRequest) error {
	cli, err := h.client()
	if err != nil {
		return err
	}
	return cli.FSSyncStatusRequest(ctx, arg)
}
