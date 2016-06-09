// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type RekeyHandler struct {
	*BaseHandler
	gregor *gregorHandler
	libkb.Contextified
}

func NewRekeyHandler(xp rpc.Transporter, g *libkb.GlobalContext, gregor *gregorHandler) *RekeyHandler {
	return &RekeyHandler{
		BaseHandler:  NewBaseHandler(xp),
		gregor:       gregor,
		Contextified: libkb.NewContextified(g),
	}
}

func (h *RekeyHandler) ShowPendingRekeyStatus(ctx context.Context, sessionID int) error {
	psetDevices, err := h.GetPendingRekeyStatus(ctx, sessionID)
	if err != nil {
		return err
	}
	rekeyUI, err := h.G().UIRouter.GetRekeyUINoSessionID()
	if err != nil {
		return err
	}
	if rekeyUI == nil {
		return errors.New("no rekey ui")
	}
	arg := keybase1.RefreshArg{
		SessionID:         sessionID,
		ProblemSetDevices: psetDevices,
	}
	return rekeyUI.Refresh(ctx, arg)
}

func (h *RekeyHandler) GetPendingRekeyStatus(ctx context.Context, sessionID int) (keybase1.ProblemSetDevices, error) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(h.G()))
	if err != nil {
		return keybase1.ProblemSetDevices{}, err
	}
	pset, err := scoreProblemFolders(h.G(), keybase1.ProblemSet{})
	if err != nil {
		return keybase1.ProblemSetDevices{}, err
	}
	return newProblemSetDevices(me, pset)
}

func (h *RekeyHandler) DebugShowRekeyStatus(ctx context.Context, arg keybase1.DebugShowRekeyStatusArg) error {
	return nil
}

func (h *RekeyHandler) RekeyStatusFinish(ctx context.Context, sessionID int) (keybase1.Outcome, error) {
	return h.gregor.RekeyStatusFinish(ctx, sessionID)
}

func newProblemSetDevices(u *libkb.User, pset keybase1.ProblemSet) (keybase1.ProblemSetDevices, error) {
	var set keybase1.ProblemSetDevices
	set.ProblemSet = pset

	ckf := u.GetComputedKeyFamily()

	dset := make(map[keybase1.DeviceID]bool)
	for _, f := range pset.Tlfs {
		for _, kid := range f.Solutions {
			dev, err := ckf.GetDeviceForKID(kid)
			if err != nil {
				return keybase1.ProblemSetDevices{}, err
			}
			if dset[dev.ID] {
				continue
			}
			dset[dev.ID] = true
			set.Devices = append(set.Devices, *(dev.ProtExport()))
		}
	}
	return set, nil
}
