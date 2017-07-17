// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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
	launchNetworkChecks *launchNetworkChecks
	keys                []keybase1.IdentifyKey
	lastTrack           **keybase1.TrackSummary
	token               *keybase1.TrackToken
	suppressed          bool
	userCard            *keybase1.UserCard
}

func newBufferedIdentifyUI(g *libkb.GlobalContext, u libkb.IdentifyUI, c keybase1.ConfirmResult) *bufferedIdentifyUI {
	return &bufferedIdentifyUI{
		Contextified:        libkb.NewContextified(g),
		raw:                 u,
		confirmIfSuppressed: c,
		bufferedMode:        true,
	}
}

func (b *bufferedIdentifyUI) Start(s string, r keybase1.IdentifyReason, f bool) error {
	b.Lock()
	defer b.Unlock()
	b.start = &start{s, r, f}
	return b.flush(false)
}

func (b *bufferedIdentifyUI) flush(trackingBroke bool) (err error) {

	// Look up the calling function for debugging purposes
	pc := make([]uintptr, 10) // at least 1 entry needed
	runtime.Callers(2, pc)
	f := runtime.FuncForPC(pc[0])
	caller := path.Base(f.Name())

	b.G().Log.Debug("+ bufferedIdentifyUI#flush(%v) [caller=%s, buffered=%v, suppressed=%v]", trackingBroke, caller, b.bufferedMode, b.suppressed)

	if !trackingBroke && b.bufferedMode {
		b.G().Log.Debug("- bufferedIdentifyUI#flush: short-circuit")
		return nil
	}

	defer func() {
		b.flushCleanup()
		b.G().Log.Debug("- bufferedIdentifyUI#flush -> %v", err)
	}()

	if b.start != nil {
		err = b.raw.Start(b.start.s, b.start.r, b.start.f)
		if err != nil {
			return err
		}
	}

	for _, k := range b.keys {
		err = b.raw.DisplayKey(k)
		if err != nil {
			return err
		}
	}

	if b.lastTrack != nil {
		err = b.raw.ReportLastTrack(*b.lastTrack)
		if err != nil {
			return err
		}
	}

	if b.launchNetworkChecks != nil {
		err = b.raw.LaunchNetworkChecks(b.launchNetworkChecks.i, b.launchNetworkChecks.u)
		if err != nil {
			return err
		}
	}

	if b.userCard != nil {
		err = b.raw.DisplayUserCard(*b.userCard)
		if err != nil {
			return err
		}
	}

	for _, w := range b.proofChecks {
		var err error
		if w.social {
			err = b.raw.FinishSocialProofCheck(w.p, w.l)
		} else {
			err = b.raw.FinishWebProofCheck(w.p, w.l)
		}
		if err != nil {
			return err
		}
	}

	for _, c := range b.cryptocurrency {
		err = b.raw.DisplayCryptocurrency(c)
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
	b.bufferedMode = false
	b.launchNetworkChecks = nil
	b.keys = nil
	b.lastTrack = nil
	b.userCard = nil
}

func (b *bufferedIdentifyUI) FinishWebProofCheck(p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	b.Lock()
	defer b.Unlock()
	b.proofChecks = append(b.proofChecks, proofCheck{false, p, l})
	return b.flush(l.BreaksTracking)
}

func (b *bufferedIdentifyUI) FinishSocialProofCheck(p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	b.Lock()
	defer b.Unlock()
	b.proofChecks = append(b.proofChecks, proofCheck{true, p, l})
	return b.flush(l.BreaksTracking)
}

func (b *bufferedIdentifyUI) Confirm(o *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	b.Lock()
	defer b.Unlock()
	if b.bufferedMode {
		b.G().Log.Debug("| bufferedIdentifyUI#Confirm: suppressing output")
		b.suppressed = true
		return b.confirmIfSuppressed, nil
	}
	b.G().Log.Debug("| bufferedIdentifyUI#Confirm: enabling output")
	b.flush(true)
	return b.raw.Confirm(o)
}

func (b *bufferedIdentifyUI) DisplayCryptocurrency(c keybase1.Cryptocurrency) error {
	b.Lock()
	defer b.Unlock()
	b.cryptocurrency = append(b.cryptocurrency, c)
	return b.flush(false)
}

func (b *bufferedIdentifyUI) DisplayKey(k keybase1.IdentifyKey) error {
	b.Lock()
	defer b.Unlock()
	b.keys = append(b.keys, k)
	return b.flush(k.BreaksTracking)
}

func (b *bufferedIdentifyUI) ReportLastTrack(s *keybase1.TrackSummary) error {
	b.Lock()
	defer b.Unlock()
	b.lastTrack = &s
	return b.flush(false)
}

func (b *bufferedIdentifyUI) LaunchNetworkChecks(i *keybase1.Identity, u *keybase1.User) error {
	b.Lock()
	defer b.Unlock()
	b.launchNetworkChecks = &launchNetworkChecks{i, u}
	return b.flush(i.BreaksTracking)
}

func (b *bufferedIdentifyUI) DisplayTrackStatement(s string) error {
	return b.raw.DisplayTrackStatement(s)
}

func (b *bufferedIdentifyUI) DisplayUserCard(c keybase1.UserCard) error {
	b.Lock()
	defer b.Unlock()
	b.userCard = &c
	return b.flush(false)
}

func (b *bufferedIdentifyUI) ReportTrackToken(t keybase1.TrackToken) error {
	b.Lock()
	defer b.Unlock()
	if b.suppressed {
		return nil
	}
	return b.raw.ReportTrackToken(t)
}

func (b *bufferedIdentifyUI) Cancel() error {
	b.Lock()
	defer b.Unlock()

	// Cancel should always go through to UI server
	return b.raw.Cancel()
}

func (b *bufferedIdentifyUI) Finish() error {
	b.Lock()
	defer b.Unlock()
	if b.suppressed {
		b.G().Log.Debug("| bufferedIdentifyUI#Finish: suppressed")
		return nil
	}
	b.G().Log.Debug("| bufferedIdentifyUI#Finish: went through to UI")

	// This is likely a noop since we already covered this case in the `Confirm` step
	// above. However, if due a bug we forgot to call `Confirm` from the UI, this
	// is still useful.
	b.flush(true)

	return b.raw.Finish()
}

func (b *bufferedIdentifyUI) DisplayTLFCreateWithInvite(d keybase1.DisplayTLFCreateWithInviteArg) error {
	return b.raw.DisplayTLFCreateWithInvite(d)
}

func (b *bufferedIdentifyUI) Dismiss(s string, r keybase1.DismissReason) error {
	return b.raw.Dismiss(s, r)
}
