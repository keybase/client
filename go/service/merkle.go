// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type MerkleHandler struct {
	*BaseHandler
	libkb.Contextified
}

func newMerkleHandler(xp rpc.Transporter, g *libkb.GlobalContext) *MerkleHandler {
	return &MerkleHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *MerkleHandler) GetCurrentMerkleRoot(ctx context.Context, freshnessMsec int) (ret keybase1.MerkleRootAndTime, err error) {
	obj, err := h.G().MerkleClient.FetchRootFromServer(ctx, time.Duration(freshnessMsec)*time.Millisecond)
	if err != nil {
		return ret, err
	}
	return obj.ExportToAVDL(h.G()), nil
}
