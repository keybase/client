// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type RekeyHandler struct {
	libkb.Contextified
	*BaseHandler
	gregor          *gregorHandler
	recheckMu       sync.Mutex
	recheckDeadline time.Time
}

func NewRekeyHandler(xp rpc.Transporter, g *libkb.GlobalContext, gregor *gregorHandler) *RekeyHandler {
	h := &RekeyHandler{
		BaseHandler:  NewBaseHandler(xp),
		gregor:       gregor,
		Contextified: libkb.NewContextified(g),
	}
	h.recheckRekeyStatusPeriodic()
	return h
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

func (h *RekeyHandler) DebugShowRekeyStatus(ctx context.Context, sessionID int) error {
	if h.G().Env.GetRunMode() == libkb.ProductionRunMode {
		return errors.New("DebugShowRekeyStatus is a devel-only RPC")
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(h.G()))
	if err != nil {
		return err
	}

	arg := keybase1.RefreshArg{
		SessionID: sessionID,
		ProblemSetDevices: keybase1.ProblemSetDevices{
			ProblemSet: keybase1.ProblemSet{
				User: keybase1.User{
					Uid:      me.GetUID(),
					Username: me.GetName(),
				},
				Tlfs: []keybase1.ProblemTLF{
					keybase1.ProblemTLF{
						Tlf: keybase1.TLF{
							// this is only for debugging
							Name:      "/keybase/private/" + me.GetName(),
							Writers:   []string{me.GetName()},
							Readers:   []string{me.GetName()},
							IsPrivate: true,
						},
					},
				},
			},
		},
	}

	devices := me.GetComputedKeyFamily().GetAllActiveDevices()
	arg.ProblemSetDevices.Devices = make([]keybase1.Device, len(devices))
	for i, dev := range devices {
		arg.ProblemSetDevices.Devices[i] = *(dev.ProtExport())
	}

	rekeyUI, err := h.G().UIRouter.GetRekeyUINoSessionID()
	if err != nil {
		return err
	}
	if rekeyUI == nil {
		h.G().Log.Debug("no rekey ui, would have called refresh with this:")
		h.G().Log.Debug("arg: %+v", arg)
		return errors.New("no rekey ui")
	}

	return rekeyUI.Refresh(ctx, arg)
}

func (h *RekeyHandler) RekeyStatusFinish(ctx context.Context, sessionID int) (keybase1.Outcome, error) {
	outcome, err := h.gregor.RekeyStatusFinish(ctx, sessionID)
	if err == nil {
		// recheck rekey status 24h from now
		h.recheckMu.Lock()
		h.recheckDeadline = time.Now().Add(24 * time.Hour)
		h.recheckMu.Unlock()
	}
	return outcome, err
}

func (h *RekeyHandler) recheckRekeyStatusPeriodic() {
	h.G().Log.Debug("starting recheck rekey status loop")
	ticker := time.NewTicker(1 * time.Hour)
	h.G().PushShutdownHook(func() error {
		h.G().Log.Debug("stopping recheckRekeyStatus timer")
		ticker.Stop()
		return nil
	})
	go func() {
		for {
			<-ticker.C
			h.recheckMu.Lock()
			if h.recheckDeadline.IsZero() {
				h.recheckMu.Unlock()
				continue
			}
			if time.Now().Before(h.recheckDeadline) {
				h.recheckMu.Unlock()
				continue
			}
			h.recheckMu.Unlock()
			h.G().Log.Debug("rechecking rekey status")

			h.recheckRekeyStatus()

			h.recheckMu.Lock()
			h.recheckDeadline = time.Time{}
			h.recheckMu.Unlock()
		}
	}()
}

func (h *RekeyHandler) recheckRekeyStatus() {
	ctx := context.Background()
	psetDevices, err := h.GetPendingRekeyStatus(ctx, 0)
	if err != nil {
		h.G().Log.Warning("recheckRekeyStatus: error getting pending rekey status: %s", err)
		return
	}

	numTLFs := len(psetDevices.ProblemSet.Tlfs)
	if numTLFs == 0 {
		h.G().Log.Debug("recheckRekeyStatus: empty problem set")
		return
	}

	h.G().Log.Debug("recheckRekeyStatus: need to harass user, %d TLFs need help", numTLFs)
}

func newProblemSetDevices(u *libkb.User, pset keybase1.ProblemSet) (keybase1.ProblemSetDevices, error) {
	var set keybase1.ProblemSetDevices
	set.ProblemSet = pset

	ckf := u.GetComputedKeyFamily()

	dset := make(map[keybase1.DeviceID]bool)
	for _, f := range pset.Tlfs {
		for _, kid := range f.Solution_kids {
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
