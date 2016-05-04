// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	// "flag"
	"github.com/keybase/client/go/libkb"
	// "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	libkbfs "github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type MobileHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewMobileHandler(xp rpc.Transporter, g *libkb.GlobalContext) *MobileHandler {
	return &MobileHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *MobileHandler) Hellokbfs(ctx context.Context, arg keybase1.HellokbfsArg) (string, error) {
	name := "chrisnojima"

	// kbfsParams := libkbfs.AddFlags(flag.CommandLine)
	// flag.Parse()

	// log := logger.NewWithCallDepth("", 1)
	// config, err := libkbfs.Init(*kbfsParams, nil, log)

	fmt.Println("bbbbbb calling parse")
	handle, err := libkbfs.ParseTlfHandle(
		ctx, libkbfs.MobileConfig.KBPKI(), name, true, /*p.public*/
		false /*config.SharingBeforeSignupEnabled()*/)
	fmt.Println("bbbbbb after parse", handle, err)

	n, ei, err :=
		libkbfs.MobileConfig.KBFSOps().GetOrCreateRootNode(
			ctx, handle, libkbfs.MasterBranch)

	fmt.Println("bbbbbb n ei err", n, ei, err)

	components := []string{""}
	for _, component := range /*p.tlfComponents*/ components {
		fmt.Println("bbbbbb component", component)
		cn, cei, err := libkbfs.MobileConfig.KBFSOps().Lookup(ctx, n, component)
		if err != nil {
			fmt.Println("bbbbbb err", err)
			// return nil, libkbfs.EntryInfo{}, err
			continue
		}
		n = cn
		ei = cei
	}

	fmt.Println("bbbbbb after", n, ei)

	return arg.Echo + " world", nil
}
