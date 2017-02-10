// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"time"

	gregor "github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

const TLFRekeyGregorCategory = "kbfs_tlf_rekey_needed"

// rekeyMaster is the object that controls all rekey harassment in the keybase service.
// There should only be one such object per service process.
type rekeyMaster struct {
	libkb.Contextified

	// The rekeyMaster is usually sleeping, but its sleep can be interrupted by various
	// exogenous and internal events. These events are sent into this channel.
	interruptCh chan interruptArg

	ui            *RekeyUI
	uiRouter      *UIRouter
	sleepUntil    time.Time
	plannedWakeup time.Time
	uiNeeded      bool
	uiVisible     bool

	// We need to be able to access the gregor full state to see if there are any
	// TLF rekey events. We should only be running if there are (since we want to respect
	// the 3-minute delay on rekey harassment after a new key is added).
	gregor *gregorHandler
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

func (r *rekeyMaster) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, ibm gregor.Item) (bool, error) {
	switch category {
	case TLFRekeyGregorCategory:
		return true, r.handleGregorDismissal()
	}
	return true, nil
}

var _ libkb.GregorInBandMessageHandler = (*rekeyMaster)(nil)

func (r *rekeyMaster) handleGregorCreation() error {
	r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptCreation}
	return nil
}

func (r *rekeyMaster) handleGregorDismissal() error {
	r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptDismissal}
	return nil
}

func (r *rekeyMaster) Logout() {
	// Beware deadlocks here! See CORE-3690 for an example. We sometimes
	// block on login state to make an API call. But we don't want
	// LoginState to block on us during a logout call, so send this one
	// async
	go func() {
		r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptLogout}
	}()
}

func (r *rekeyMaster) Login() {
	// See comment about Logout() for deadlock avoidance.
	go func() {
		r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptLogin}
	}()
}

func (r *rekeyMaster) newUIRegistered() {
	r.interruptCh <- interruptArg{rekeyInterrupt: RekeyInterruptNewUI}
}

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

	// Calling with the clear=true boolean means the server will potentially
	// clear all gregor messages as a side-effect of the lookup. Hence the
	// POST rather than GET for this operation.
	args := libkb.HTTPArgs{
		"clear": libkb.B{Val: true},
	}

	var tmp rekeyQueryResult
	err := g.API.PostDecode(libkb.APIArg{
		Endpoint:    "kbfs/problem_sets",
		NeedSession: true,
		Args:        args,
	}, &tmp)

	return tmp.ProblemSet, err
}

func (r *rekeyMaster) continueSleep(ri RekeyInterrupt) (ret time.Duration) {

	r.G().Log.Debug("+ rekeyMaster#continueSleep")
	defer func() {
		r.G().Log.Debug("- rekeyMaster#continueSleep -> %s", ret)
	}()

	if r.sleepUntil.IsZero() {
		return ret
	}

	dur := r.sleepUntil.Sub(r.G().Clock().Now())

	if dur <= 0 {
		r.G().Log.Debug("| Snooze deadline exceeded (%s ago)", -dur)
		r.sleepUntil = time.Time{}
		return ret
	}

	if ri == RekeyInterruptLogin {
		r.G().Log.Debug("| resetting sleep until after new login")
		r.sleepUntil = time.Time{}
		return ret
	}

	r.G().Log.Debug("| Sleeping until %s (%s more)", r.sleepUntil, dur)
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
		r.sleepUntil = r.G().Clock().Now().Add(ret)
		r.G().Log.Debug("| UI said finished; sleeping %s [%p]", ret, r)
		return ret, nil
	}

	if ri == RekeyInterruptNewUI && !r.uiNeeded {
		r.G().Log.Debug("| we got a new UI but didn't need it; resuming sleep")
		return r.resumeSleep(), nil
	}

	if ri != RekeyInterruptSyncForce && ri != RekeyInterruptShowUI {
		if ret = r.continueSleep(ri); ret > 0 {
			r.G().Log.Debug("| Skipping compute and act due to sleep state")
			return ret, nil
		}
	}

	// compute which folders if any have problems
	ret, problemsAndDevices, event, err = r.computeProblems()
	if err != nil {
		return ret, err
	}

	// sendRekeyEvent sends a debug message to the UI (useful only in testing)
	event.InterruptType = int(ri)
	r.sendRekeyEvent(event)

	err = r.actOnProblems(problemsAndDevices, event)
	return ret, err
}

func (r *rekeyMaster) getUI() (ret *RekeyUI, err error) {
	ret, err = r.uiRouter.getOrReuseRekeyUI(r.ui)
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

	if e.InterruptType == int(RekeyInterruptSync) {
		r.G().Log.Debug("| No need to send a rekey event on a Sync() RPC")
		return nil
	}

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

	if problemsAndDevices == nil {
		err = r.clearUI()
		return err
	}

	err = r.spawnOrRefreshUI(*problemsAndDevices)
	return err
}

func (r *rekeyMaster) hasGregorTLFRekeyMessages() (ret bool, err error) {
	defer r.G().Trace("hasGregorTLFRekeyMessages", func() error { return err })()

	var state gregor1.State
	state, err = r.gregor.getState()
	if err != nil {
		return false, err
	}

	for _, item := range state.Items_ {
		if item.Item_ != nil && string(item.Item_.Category_) == TLFRekeyGregorCategory {
			return true, nil
		}
	}
	return false, nil
}

func (r *rekeyMaster) computeProblems() (nextWait time.Duration, problemsAndDevices *keybase1.ProblemSetDevices, event keybase1.RekeyEvent, err error) {
	defer r.G().Trace("rekeyMaster#computeProblems", func() error { return err })()

	if loggedIn, _, _ := libkb.IsLoggedIn(r.G(), nil); !loggedIn {
		r.G().Log.Debug("| not logged in")
		nextWait = rekeyTimeoutBackground
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_NOT_LOGGED_IN}, err
	}

	r.G().Log.Debug("| rekeyMaster#computeProblems: logged in")

	hasGregor, err := r.hasGregorTLFRekeyMessages()
	if err != nil {
		nextWait = rekeyTimeoutAPIError
		r.G().Log.Debug("| snoozing rekeyMaster for %ds on gregor error", nextWait)
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_API_ERROR}, err
	}

	if !hasGregor {
		r.G().Log.Debug("| has gregor TLF rekey messages")
		nextWait = rekeyTimeoutBackground
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_NO_GREGOR_MESSAGES}, err
	}

	r.G().Log.Debug("| rekeyMaster#computeProblems: has gregor")

	var problems keybase1.ProblemSet
	problems, err = queryAPIServerForRekeyInfo(r.G())
	if err != nil {
		nextWait = rekeyTimeoutAPIError
		r.G().Log.Debug("| snoozing rekeyMaster for %ds on API error", nextWait)
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_API_ERROR}, err
	}

	r.G().Log.Debug("| rekeyMaster#computeProblems: queried API server for rekey info")

	if len(problems.Tlfs) == 0 {
		r.G().Log.Debug("| no problem TLFs found")
		nextWait = rekeyTimeoutBackground
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_NO_PROBLEMS}, err
	}

	var me *libkb.User
	me, err = libkb.LoadMe(libkb.NewLoadUserArg(r.G()))
	r.G().Log.Debug("| rekeyMaster#computeProblems: loaded me")

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

	r.G().Log.Debug("| rekeyMaster#computeProblems: current device computed")

	var tmp keybase1.ProblemSetDevices
	tmp, err = newProblemSetDevices(me, problems)
	if err != nil {
		nextWait = rekeyTimeoutDeviceLoadError
		r.G().Log.Debug("| hit error in loading devices")
		return nextWait, nil, keybase1.RekeyEvent{EventType: keybase1.RekeyEventType_DEVICE_LOAD_ERROR}, err
	}

	r.G().Log.Debug("| rekeyMaster#computeProblems: made problem set devices")

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

type unkeyedTLFsQueryResult struct {
	Status libkb.AppStatus `json:"status"`
	TLFs   []keybase1.TLF  `json:"tlfs"`
}

func (u *unkeyedTLFsQueryResult) GetAppStatus() *libkb.AppStatus {
	return &u.Status
}

func (r *RekeyHandler2) GetRevokeWarning(_ context.Context, arg keybase1.GetRevokeWarningArg) (res keybase1.RevokeWarning, err error) {
	var u unkeyedTLFsQueryResult
	actingDevice := arg.ActingDevice
	if actingDevice.IsNil() {
		actingDevice = r.G().Env.GetDeviceID()
	}

	err = r.G().API.GetDecode(libkb.APIArg{
		Endpoint:    "kbfs/unkeyed_tlfs_from_pair",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"self_device_id":   libkb.S{Val: string(actingDevice)},
			"target_device_id": libkb.S{Val: string(arg.TargetDevice)},
		},
	}, &u)
	res.EndangeredTLFs = u.TLFs
	return res, err
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

func keysSolveProblemTLF(keys []libkb.GenericKey, tlf keybase1.ProblemTLF) bool {
	var ourKIDs []keybase1.KID
	for _, key := range keys {
		if key != nil {
			ourKIDs = append(ourKIDs, key.GetKID())
		}
	}
	for _, theirKID := range tlf.Solution_kids {
		for _, ourKID := range ourKIDs {
			if ourKID.Equal(theirKID) {
				return true
			}
		}
	}
	return false
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
