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
	scorer          func(g *libkb.GlobalContext, existing keybase1.ProblemSet) (keybase1.ProblemSet, error)
	recheckMu       sync.Mutex
	recheckDeadline time.Time
	recheckTicker   *time.Ticker
}

func NewRekeyHandler(xp rpc.Transporter, g *libkb.GlobalContext, gregor *gregorHandler) *RekeyHandler {
	h := &RekeyHandler{
		BaseHandler:  NewBaseHandler(xp),
		gregor:       gregor,
		scorer:       scoreProblemFolders,
		Contextified: libkb.NewContextified(g),
	}
	h.recheckRekeyStatusPeriodic()
	return h
}

func (h *RekeyHandler) Shutdown() {
	h.G().Log.Debug("stopping recheckRekeyStatus timer")
	h.recheckTicker.Stop()
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
	pset, err := h.scorer(h.G(), keybase1.ProblemSet{})
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
		h.setRecheckDeadline()
	}
	return outcome, err
}

func (h *RekeyHandler) Sync(ctx context.Context, sessionID int) error {
	return nil
}

// recheckRekeyStatusPeriodic checks the recheckDeadline every hour.
// If it is set and the current time is after the deadline, then
// it will recheck the rekey status for this user.
func (h *RekeyHandler) recheckRekeyStatusPeriodic() {
	h.G().Log.Debug("starting recheck rekey status loop")
	h.recheckTicker = time.NewTicker(1 * time.Hour)
	go h.recheckRekeyStatusTicker(h.recheckTicker.C)
}

func (h *RekeyHandler) recheckRekeyStatusTicker(ticker <-chan time.Time) {
	for {
		// this fires every hour
		<-ticker

		// continue if not at recheck deadline (or there
		// isn't a deadline set)
		if !h.atRecheckDeadline() {
			continue
		}

		// recheck rekey status
		h.G().Log.Debug("rechecking rekey status")
		h.recheckRekeyStatus()

		// clear the deadline
		h.clearRecheckDeadline()
	}
}

// atRecheckDeadline returns true if the current time is after
// recheckDeadline.  If recheckDeadline isn't set, it returns
// false.
func (h *RekeyHandler) atRecheckDeadline() bool {
	h.recheckMu.Lock()
	defer h.recheckMu.Unlock()

	if h.recheckDeadline.IsZero() {
		return false
	}

	if h.G().Clock().Now().Before(h.recheckDeadline) {
		return false
	}

	return true
}

// clearRecheckDeadline sets the recheck deadline to zero.
func (h *RekeyHandler) clearRecheckDeadline() {
	h.recheckMu.Lock()
	defer h.recheckMu.Unlock()

	h.recheckDeadline = time.Time{}
}

// isRecheckDeadlineZero returns true if the recheckDeadline is zero/unset.
func (h *RekeyHandler) isRecheckDeadlineZero() bool {
	h.recheckMu.Lock()
	defer h.recheckMu.Unlock()

	return h.recheckDeadline.IsZero()
}

// setRecheckDeadline sets the recheck deadline to 24 hours from now.
func (h *RekeyHandler) setRecheckDeadline() {
	h.recheckMu.Lock()
	defer h.recheckMu.Unlock()

	h.recheckDeadline = h.G().Clock().Now().Add(24 * time.Hour)
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
	if err := h.gregor.RekeyReharass(ctx, psetDevices); err != nil {
		h.G().Log.Warning("recheckRekeyStatus: reharass error: %s", err)
	}
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
