// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"path"
	"runtime"
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type start struct {
	s string
	r keybase1.IdentifyReason
	f bool
}

type proofCheck struct {
	social bool
	p      keybase1.RemoteProof
	l      keybase1.LinkCheckResult
}

type launchNetworkChecks struct {
	i *keybase1.Identity
	u *keybase1.User
}

type bufferedIdentifyUI struct {
	libkb.Contextified
	sync.Mutex
	raw                 libkb.IdentifyUI
	confirmIfSuppressed keybase1.ConfirmResult
	bufferedMode        bool
	start               *start
	proofChecks         []proofCheck
	cryptocurrency      []keybase1.Cryptocurrency
	stellar             *keybase1.StellarAccount
	launchNetworkChecks *launchNetworkChecks
	keys                []keybase1.IdentifyKey
	lastTrack           **keybase1.TrackSummary
	token               *keybase1.TrackToken
	suppressed          bool
	userCard            *keybase1.UserCard
}

var _ libkb.IdentifyUI = (*bufferedIdentifyUI)(nil)

func newBufferedIdentifyUI(g *libkb.GlobalContext, u libkb.IdentifyUI, c keybase1.ConfirmResult) *bufferedIdentifyUI {
	return &bufferedIdentifyUI{
		Contextified:        libkb.NewContextified(g),
		raw:                 u,
		confirmIfSuppressed: c,
		bufferedMode:        true,
	}
}

func (b *bufferedIdentifyUI) Start(m libkb.MetaContext, s string, r keybase1.IdentifyReason, f bool) error {
	b.Lock()
	defer b.Unlock()
	b.start = &start{s, r, f}
	return b.flush(m, false)
}

func (b *bufferedIdentifyUI) flush(m libkb.MetaContext, trackingBroke bool) (err error) {

	// Look up the calling function for debugging purposes
	pc := make([]uintptr, 10) // at least 1 entry needed
	runtime.Callers(2, pc)
	f := runtime.FuncForPC(pc[0])
	caller := path.Base(f.Name())

	m.Debug("+ bufferedIdentifyUI#flush(%v) [caller=%s, buffered=%v, suppressed=%v]", trackingBroke, caller, b.bufferedMode, b.suppressed)

	if !trackingBroke && b.bufferedMode {
		m.Debug("- bufferedIdentifyUI#flush: short-circuit")
		return nil
	}

	defer func() {
		b.flushCleanup()
		m.Debug("- bufferedIdentifyUI#flush -> %v", err)
	}()

	if b.start != nil {
		err = b.raw.Start(m, b.start.s, b.start.r, b.start.f)
		if err != nil {
			return err
		}
	}

	for _, k := range b.keys {
		err = b.raw.DisplayKey(m, k)
		if err != nil {
			return err
		}
	}

	if b.lastTrack != nil {
		err = b.raw.ReportLastTrack(m, *b.lastTrack)
		if err != nil {
			return err
		}
	}

	if b.launchNetworkChecks != nil {
		err = b.raw.LaunchNetworkChecks(m, b.launchNetworkChecks.i, b.launchNetworkChecks.u)
		if err != nil {
			return err
		}
	}

	if b.userCard != nil {
		err = b.raw.DisplayUserCard(m, *b.userCard)
		if err != nil {
			return err
		}
	}

	for _, w := range b.proofChecks {
		var err error
		if w.social {
			err = b.raw.FinishSocialProofCheck(m, w.p, w.l)
		} else {
			err = b.raw.FinishWebProofCheck(m, w.p, w.l)
		}
		if err != nil {
			return err
		}
	}

	for _, c := range b.cryptocurrency {
		err = b.raw.DisplayCryptocurrency(m, c)
		if err != nil {
			return err
		}
	}

	if b.stellar != nil {
		err = b.raw.DisplayStellarAccount(m, *b.stellar)
		if err != nil {
			return err
		}
	}

	return nil
}

func (b *bufferedIdentifyUI) flushCleanup() {
	b.start = nil
	b.proofChecks = nil
	b.cryptocurrency = nil
	b.stellar = nil
	b.bufferedMode = false
	b.launchNetworkChecks = nil
	b.keys = nil
	b.lastTrack = nil
	b.userCard = nil
}

func (b *bufferedIdentifyUI) FinishWebProofCheck(m libkb.MetaContext, p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	b.Lock()
	defer b.Unlock()
	b.proofChecks = append(b.proofChecks, proofCheck{false, p, l})
	return b.flush(m, l.BreaksTracking)
}

func (b *bufferedIdentifyUI) FinishSocialProofCheck(m libkb.MetaContext, p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	b.Lock()
	defer b.Unlock()
	b.proofChecks = append(b.proofChecks, proofCheck{true, p, l})
	return b.flush(m, l.BreaksTracking)
}

func (b *bufferedIdentifyUI) Confirm(m libkb.MetaContext, o *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	b.Lock()
	defer b.Unlock()
	if b.bufferedMode {
		m.Debug("| bufferedIdentifyUI#Confirm: suppressing output")
		b.suppressed = true
		return b.confirmIfSuppressed, nil
	}
	m.Debug("| bufferedIdentifyUI#Confirm: enabling output")
	b.flush(m, true)
	return b.raw.Confirm(m, o)
}

func (b *bufferedIdentifyUI) DisplayCryptocurrency(m libkb.MetaContext, c keybase1.Cryptocurrency) error {
	b.Lock()
	defer b.Unlock()
	b.cryptocurrency = append(b.cryptocurrency, c)
	return b.flush(m, false)
}

func (b *bufferedIdentifyUI) DisplayStellarAccount(m libkb.MetaContext, c keybase1.StellarAccount) error {
	b.Lock()
	defer b.Unlock()
	b.stellar = &c
	return b.flush(m, false)
}

func (b *bufferedIdentifyUI) DisplayKey(m libkb.MetaContext, k keybase1.IdentifyKey) error {
	b.Lock()
	defer b.Unlock()
	b.keys = append(b.keys, k)
	return b.flush(m, k.BreaksTracking)
}

func (b *bufferedIdentifyUI) ReportLastTrack(m libkb.MetaContext, s *keybase1.TrackSummary) error {
	b.Lock()
	defer b.Unlock()
	b.lastTrack = &s
	return b.flush(m, false)
}

func (b *bufferedIdentifyUI) LaunchNetworkChecks(m libkb.MetaContext, i *keybase1.Identity, u *keybase1.User) error {
	b.Lock()
	defer b.Unlock()
	b.launchNetworkChecks = &launchNetworkChecks{i, u}
	return b.flush(m, i.BreaksTracking)
}

func (b *bufferedIdentifyUI) DisplayTrackStatement(m libkb.MetaContext, s string) error {
	return b.raw.DisplayTrackStatement(m, s)
}

func (b *bufferedIdentifyUI) DisplayUserCard(m libkb.MetaContext, c keybase1.UserCard) error {
	b.Lock()
	defer b.Unlock()
	b.userCard = &c
	return b.flush(m, false)
}

func (b *bufferedIdentifyUI) ReportTrackToken(m libkb.MetaContext, t keybase1.TrackToken) error {
	b.Lock()
	defer b.Unlock()
	if b.suppressed {
		return nil
	}
	return b.raw.ReportTrackToken(m, t)
}

func (b *bufferedIdentifyUI) Cancel(m libkb.MetaContext) error {
	b.Lock()
	defer b.Unlock()

	// Cancel should always go through to UI server
	return b.raw.Cancel(m)
}

func (b *bufferedIdentifyUI) Finish(m libkb.MetaContext) error {
	b.Lock()
	defer b.Unlock()
	if b.suppressed {
		m.Debug("| bufferedIdentifyUI#Finish: suppressed")
		return nil
	}
	m.Debug("| bufferedIdentifyUI#Finish: went through to UI")

	// This is likely a noop since we already covered this case in the `Confirm` step
	// above. However, if due a bug we forgot to call `Confirm` from the UI, this
	// is still useful.
	b.flush(m, true)

	return b.raw.Finish(m)
}

func (b *bufferedIdentifyUI) DisplayTLFCreateWithInvite(m libkb.MetaContext, d keybase1.DisplayTLFCreateWithInviteArg) error {
	return b.raw.DisplayTLFCreateWithInvite(m, d)
}

func (b *bufferedIdentifyUI) Dismiss(m libkb.MetaContext, s string, r keybase1.DismissReason) error {
	return b.raw.Dismiss(m, s, r)
}
