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
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *MerkleHandler) GetCurrentMerkleRoot(ctx context.Context, freshnessMsec int) (ret keybase1.MerkleRootAndTime, err error) {
	obj, err := h.G().MerkleClient.FetchRootFromServer(h.MetaContext(ctx), time.Duration(freshnessMsec)*time.Millisecond)
	if err != nil {
		return ret, err
	}
	return obj.ExportToAVDL(h.G()), nil
}

func (h *MerkleHandler) VerifyMerkleRootAndKBFS(ctx context.Context, arg keybase1.VerifyMerkleRootAndKBFSArg) (err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	m = m.WithLogTag("MRKL")
	defer m.CTraceTimed("MerkleHandler#VerifyMerkleRootAndKBFS", func() error { return err })()
	err = libkb.VerifyMerkleRootAndKBFS(m, arg)
	return err
}
