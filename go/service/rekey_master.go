// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	gregor "github.com/keybase/gregor"
	gregor1 "github.com/keybase/gregor/protocol/gregor1"
	context "golang.org/x/net/context"
	"time"
)

const TLFRekeyGregorCategory = "kbfs_tlf_rekey_needed"

type rekeyMaster struct {
	libkb.Contextified
	interruptCh   chan interruptArg
	ui            *RekeyUI
	uiRouter      *UIRouter
	snoozeUntil   time.Time
	plannedWakeup time.Time
	uiNeeded      bool
	uiVisible     bool
}

type interruptArg struct {
	retCh          chan struct{}
	rekeyInterrupt RekeyInterrupt
}

func newRekeyMaster(g *libkb.GlobalContext) *rekeyMaster {
	return &rekeyMaster{
		Contextified: libkb.NewContextified(g),
		interruptCh:  make(chan interruptArg),
	}
}

func (r *rekeyMaster) Start() {
	go r.mainLoop()
}

func (r *rekeyMaster) IsAlive() bool {
	return true
}
func (r *rekeyMaster) Name() string {
	return "rekeyMaster"
}

func (r *rekeyMaster) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, ibm gregor.Item) (bool, error) {
	switch category {
	case TLFRekeyGregorCategory:
		r.G().Log.Debug("incoming gregor: %+v", ibm)
		return true, r.handleGregorCreation()
	}
	return true, nil
}

func (r *rekeyMaster) handleGregorCreation() error {
	r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptCreation}
	return nil
}

func (r *rekeyMaster) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, ibm gregor.Item) (bool, error) {
	switch category {
	case TLFRekeyGregorCategory:
		return true, r.handleGregorDismissal()
	}
	return true, nil
}

func (r *rekeyMaster) handleGregorDismissal() error {
	r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptDismissal}
	return nil
}

func (r *rekeyMaster) gregorHandler() *rekeyMaster {
	return r
}

func (r *rekeyMaster) Logout() {
	r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptLogout}
}

func (r *rekeyMaster) Login() {
	r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptLogin}
}

func (r *rekeyMaster) newUIRegistered() {
	r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptNewUI}
}

type RekeyInterrupt int

const (
	RekeyInterruptNone       RekeyInterrupt = 0
	RekeyInterruptTimeout    RekeyInterrupt = 1
	RekeyInterruptCreation   RekeyInterrupt = 2
	RekeyInterruptDismissal  RekeyInterrupt = 3
	RekeyInterruptLogout     RekeyInterrupt = 4
	RekeyInterruptLogin      RekeyInterrupt = 5
	RekeyInterruptUIFinished RekeyInterrupt = 6
	RekeyInterruptShowUI     RekeyInterrupt = 7
	RekeyInterruptNewUI      RekeyInterrupt = 8
	RekeyInterruptSync       RekeyInterrupt = 9
	RekeyInterruptSyncForce  RekeyInterrupt = 10
)

const (
	rekeyTimeoutBackground      = 24 * time.Hour
	rekeyTimeoutAPIError        = 3 * time.Minute
	rekeyTimeoutLoadMeError     = 3 * time.Minute
	rekeyTimeoutDeviceLoadError = 3 * time.Minute
	rekeyTimeoutActive          = 1 * time.Minute
	rekeyTimeoutUIFinished      = 24 * time.Hour
)

type rekeyQueryResult struct {
	Status     libkb.AppStatus     `json:"status"`
	ProblemSet keybase1.ProblemSet `json:"problem_set"`
}

func (r *rekeyQueryResult) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func queryAPIServerForRekeyInfo(g *libkb.GlobalContext) (keybase1.ProblemSet, error) {
	args := libkb.HTTPArgs{
		"clear": libkb.B{Val: true},
	}
	var tmp rekeyQueryResult
	// We have to post to use the clear=true feature
	err := g.API.PostDecode(libkb.APIArg{
		Contextified: libkb.NewContextified(g),
		Endpoint:     "kbfs/problem_sets",
		NeedSession:  true,
		Args:         args,
	}, &tmp)
	return tmp.ProblemSet, err
}

func (r *rekeyMaster) continueLongSnooze(ri RekeyInterrupt) (ret time.Duration) {

	r.G().Log.Debug("+ rekeyMaster#continueLongSnooze")
	defer func() {
		r.G().Log.Debug("- rekeyMaster#continueLongSnooze -> %s", ret)
	}()

	if r.snoozeUntil.IsZero() {
		return ret
	}

	dur := r.snoozeUntil.Sub(r.G().Clock().Now())

	if dur <= 0 {
		r.G().Log.Debug("| Snooze deadline exceeded (%s ago)", -dur)
		r.snoozeUntil = time.Time{}
		return ret
	}

	if ri == RekeyInterruptLogin {
		r.G().Log.Debug("| resetting snooze until after new login")
		r.snoozeUntil = time.Time{}
		return ret
	}

	r.G().Log.Debug("| Snoozing until %s (%s more)", r.snoozeUntil, dur)
	return dur
}

func (r *rekeyMaster) resumeSleep() time.Duration {
	if r.plannedWakeup.IsZero() {
		return rekeyTimeoutBackground
	}
	if ret := r.plannedWakeup.Sub(r.G().Clock().Now()); ret > 0 {
		return ret
	}
	return rekeyTimeoutActive
}

func (r *rekeyMaster) runOnce(ri RekeyInterrupt) (ret time.Duration, err error) {
	defer r.G().Trace(fmt.Sprintf("rekeyMaster#runOnce(%d) [%p]", ri, r), func() error { return err })()
	var problemsAndDevices *keybase1.ProblemSetDevices
	var event keybase1.RekeyEvent

	if ri == RekeyInterruptUIFinished {
		ret = rekeyTimeoutUIFinished
		r.uiVisible = false
		r.snoozeUntil = r.G().Clock().Now().Add(ret)
		r.G().Log.Debug("| UI said finished; hard-snoozing %s [%p]", ret, r)
		return ret, nil
	}

	if ri == RekeyInterruptNewUI && !r.uiNeeded {
		r.G().Log.Debug("| we got a new UI but didn't need it; resuming sleep")
		return r.resumeSleep(), nil
	}

	if ri != RekeyInterruptSyncForce {
		if ret = r.continueLongSnooze(ri); ret > 0 {
			r.G().Log.Debug("| Skipping compute and act due to long snooze")
			return ret, nil
		}
	}

	// compute which folders if any have problems
	ret, problemsAndDevices, event, err = r.computeProblems()
	if err != nil {
		return ret, err
	}
	event.InterruptType = int(ri)
	err = r.actOnProblems(problemsAndDevices, event)
	return ret, err
}

func (r *rekeyMaster) getUI() (ret *RekeyUI, err error) {
	ret, err = r.uiRouter.getOrReuseRekeyUI(r.ui, true)
	r.ui = ret
	return ret, err
}

func (r *rekeyMaster) clearUI() (err error) {
	defer r.G().Trace("rekeyMaster#clearUI", func() error { return err })()

	if !r.uiVisible {
		r.G().Log.Debug("| no need to clear the UI; UI wasn't visible")
		return nil
	}

	var ui *RekeyUI
	ui, err = r.getUI()

	if err != nil {
		return err
	}

	if ui == nil {
		r.uiVisible = false
		r.G().Log.Debug("| UI wasn't active, so nothing to do")
		return nil
	}

	err = ui.Refresh(context.Background(), keybase1.RefreshArg{})

	if err == nil {
		r.uiVisible = false
	}

	return err
}

func (r *rekeyMaster) spawnOrRefreshUI(problemSetDevices keybase1.ProblemSetDevices) (err error) {
	defer r.G().Trace("rekeyMaster#spawnOrRefreshUI", func() error { return err })()

	var ui *RekeyUI
	ui, err = r.getUI()
	if err != nil {
		return err
	}

	if ui == nil {
		r.G().Log.Info("| Rekey needed, but no active UI; consult logs")
		r.uiNeeded = true
		return nil
	}
	r.uiNeeded = false
	r.uiVisible = true

	err = ui.Refresh(context.Background(), keybase1.RefreshArg{ProblemSetDevices: problemSetDevices})
	return err
}

// sendRekeyEvent sends notification of a rekey event to the UI. It's largely
// used for testing.
func (r *rekeyMaster) sendRekeyEvent(e keybase1.RekeyEvent) (err error) {
	defer r.G().Trace(fmt.Sprintf("rekeyMaster#sendRekeyEvent(%v)", e), func() error { return err })()
	var ui *RekeyUI
	ui, err = r.getUI()
	if err != nil {
		return err
	}
	if ui == nil {
		r.G().Log.Debug("| no UI; not sending event information")
		return nil
	}
	err = ui.RekeySendEvent(context.Background(), keybase1.RekeySendEventArg{Event: e})
	return err
}

func (r *rekeyMaster) actOnProblems(problemsAndDevices *keybase1.ProblemSetDevices, event keybase1.RekeyEvent) (err error) {
	defer r.G().Trace(fmt.Sprintf("rekeyMaster#actOnProblems(%v)", problemsAndDevices != nil), func() error { return err })()

	// Ignore any errors
	r.sendRekeyEvent(event)

	if problemsAndDevices == nil {
		err = r.clearUI()
		return err
	}

	err = r.spawnOrRefreshUI(*problemsAndDevices)
	return err
}

func (r *rekeyMaster) computeProblems() (nextWait time.Duration, problemsAndDevices *keybase1.ProblemSetDevices, event keybase1.RekeyEvent, err error) {
	defer r.G().Trace("rekeyMaster#computeProblems", func() error { return err })()

	if loggedIn, _, _ := libkb.IsLoggedIn(r.G(), nil); !loggedIn {
		r.G().Log.Debug("| not logged in")
		nextWait = rekeyTimeoutBackground
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_NOT_LOGGED_IN}, err
	}

	var problems keybase1.ProblemSet
	problems, err = queryAPIServerForRekeyInfo(r.G())
	if err != nil {
		nextWait = rekeyTimeoutAPIError
		r.G().Log.Debug("| snoozing rekeyMaster for %ds on API error", nextWait)
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_API_ERROR}, err
	}

	if len(problems.Tlfs) == 0 {
		r.G().Log.Debug("| no problem TLFs found")
		nextWait = rekeyTimeoutBackground
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_NO_PROBLEMS}, err
	}

	var me *libkb.User
	me, err = libkb.LoadMe(libkb.NewLoadUserArg(r.G()))
	if err != nil {
		nextWait = rekeyTimeoutLoadMeError
		r.G().Log.Debug("| snoozing rekeyMaster for %ds on LoadMe error", nextWait)
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_LOAD_ME_ERROR}, err
	}

	if r.currentDeviceSolvesProblemSet(me, problems) {
		nextWait = rekeyTimeoutBackground
		r.G().Log.Debug("| snoozing rekeyMaster since current device can rekey all")
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_CURRENT_DEVICE_CAN_REKEY}, err
	}

	var tmp keybase1.ProblemSetDevices
	tmp, err = newProblemSetDevices(me, problems)
	if err != nil {
		nextWait = rekeyTimeoutDeviceLoadError
		r.G().Log.Debug("| hit error in loading devices")
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_DEVICE_LOAD_ERROR}, err
	}

	nextWait = rekeyTimeoutActive
	return nextWait, &tmp, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_HARASS}, err
}

// currentDeviceSolvesProblemSet returns true if the current device can fix all
// of the folders in the ProblemSet.
func (r *rekeyMaster) currentDeviceSolvesProblemSet(me *libkb.User, ps keybase1.ProblemSet) (ret bool) {
	r.G().Log.Debug("+ currentDeviceSolvesProblemSet")
	defer func() {
		r.G().Log.Debug("- currentDeviceSolvesProblemSet -> %v\n", ret)
	}()

	var paperKey libkb.GenericKey
	deviceKey, err := me.GetDeviceSubkey()
	if err != nil {
		r.G().Log.Info("| Problem getting device subkey: %s\n", err)
		return ret
	}

	err = r.G().LoginState().Account(func(a *libkb.Account) {
		paperKey = a.GetUnlockedPaperEncKey()
	}, "currentDeviceSolvesProblemSet")

	// We can continue though, so no need to error out
	if err != nil {
		r.G().Log.Info("| Error getting paper key: %s\n", err)
		err = nil
	}

	for _, tlf := range ps.Tlfs {
		if !keysSolveProblemTLF([]libkb.GenericKey{deviceKey, paperKey}, tlf) {
			r.G().Log.Debug("| Doesn't solve problem TLF: %s (%s)\n", tlf.Tlf.Name, tlf.Tlf.Id)
			return ret
		}
	}
	ret = true
	return ret
}

func (r *rekeyMaster) mainLoop() {

	// Sleep about ten seconds on startup so as to wait for startup sequence.
	// It's ok if we race here, but it's less work if we don't.
	timeout := 10 * time.Second

	for {

		var it RekeyInterrupt
		var interruptArg interruptArg

		select {
		case interruptArg = <-r.interruptCh:
			it = interruptArg.rekeyInterrupt
		case <-r.G().Clock().After(timeout):
			it = RekeyInterruptTimeout
		}

		timeout, _ = r.runOnce(it)
		if retCh := interruptArg.retCh; retCh != nil {
			retCh <- struct{}{}
		}
		r.plannedWakeup = r.G().Clock().Now().Add(timeout)
	}
}

type RekeyHandler2 struct {
	libkb.Contextified
	*BaseHandler
	rm *rekeyMaster
}

func NewRekeyHandler2(xp rpc.Transporter, g *libkb.GlobalContext, rm *rekeyMaster) *RekeyHandler2 {
	return &RekeyHandler2{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(xp),
		rm:           rm,
	}
}

func (r *RekeyHandler2) ShowPendingRekeyStatus(context.Context, int) error {
	r.rm.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptShowUI}
	return nil
}

func (r *RekeyHandler2) GetPendingRekeyStatus(_ context.Context, _ int) (ret keybase1.ProblemSetDevices, err error) {
	var me *libkb.User
	me, err = libkb.LoadMe(libkb.NewLoadUserArg(r.G()))
	if err != nil {
		return ret, err
	}
	var problemSet keybase1.ProblemSet
	problemSet, err = queryAPIServerForRekeyInfo(r.G())
	if err != nil {
		return ret, err
	}
	ret, err = newProblemSetDevices(me, problemSet)
	return ret, err
}

func (r *RekeyHandler2) RekeyStatusFinish(_ context.Context, _ int) (ret keybase1.Outcome, err error) {
	r.rm.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptUIFinished}
	ret = keybase1.Outcome_NONE
	return ret, err
}

func (r *RekeyHandler2) DebugShowRekeyStatus(ctx context.Context, sessionID int) error {
	if r.G().Env.GetRunMode() == libkb.ProductionRunMode {
		return errors.New("DebugShowRekeyStatus is a devel-only RPC")
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(r.G()))
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

	rekeyUI, err := r.G().UIRouter.GetRekeyUINoSessionID()
	if err != nil {
		return err
	}
	if rekeyUI == nil {
		r.G().Log.Debug("no rekey ui, would have called refresh with this:")
		r.G().Log.Debug("arg: %+v", arg)
		return errors.New("no rekey ui")
	}

	return rekeyUI.Refresh(ctx, arg)
}

func (r *RekeyHandler2) RekeySync(_ context.Context, arg keybase1.RekeySyncArg) error {
	ch := make(chan struct{})
	ri := RekeyInterruptSync
	if arg.Force {
		ri = RekeyInterruptSyncForce
	}
	r.rm.interruptCh <- interruptArg{retCh: ch, rekeyInterrupt: ri}
	<-ch
	return nil
}

var _ keybase1.RekeyInterface = (*RekeyHandler2)(nil)
