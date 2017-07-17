// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type loopbackIdentifyUI struct {
	libkb.Contextified
	sync.Mutex
	trackBreaksP **keybase1.IdentifyTrackBreaks
}

func newLoopbackIdentifyUI(g *libkb.GlobalContext, tb **keybase1.IdentifyTrackBreaks) *loopbackIdentifyUI {
	return &loopbackIdentifyUI{
		Contextified: libkb.NewContextified(g),
		trackBreaksP: tb,
	}
}

func (b *loopbackIdentifyUI) Start(s string, r keybase1.IdentifyReason, f bool) error {
	return nil
}

func (b *loopbackIdentifyUI) trackBreaks() *keybase1.IdentifyTrackBreaks {
	if *b.trackBreaksP == nil {
		*b.trackBreaksP = &keybase1.IdentifyTrackBreaks{}
	}
	return *b.trackBreaksP
}

func (b *loopbackIdentifyUI) FinishWebProofCheck(p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	b.Lock()
	defer b.Unlock()
	if l.BreaksTracking {
		tb := b.trackBreaks()
		tb.Proofs = append(tb.Proofs, keybase1.IdentifyProofBreak{
			RemoteProof: p,
			Lcr:         l,
		})
	}
	return nil
}

func (b *loopbackIdentifyUI) FinishSocialProofCheck(p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	return b.FinishWebProofCheck(p, l)
}

func (b *loopbackIdentifyUI) Confirm(o *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, nil
}

func (b *loopbackIdentifyUI) DisplayCryptocurrency(c keybase1.Cryptocurrency) error {
	return nil
}

func (b *loopbackIdentifyUI) DisplayKey(k keybase1.IdentifyKey) error {
	b.Lock()
	defer b.Unlock()
	if k.BreaksTracking {
		tb := b.trackBreaks()
		tb.Keys = append(tb.Keys, k)
	}
	return nil
}

func (b *loopbackIdentifyUI) ReportLastTrack(s *keybase1.TrackSummary) error {
	return nil
}

func (b *loopbackIdentifyUI) LaunchNetworkChecks(i *keybase1.Identity, u *keybase1.User) error {
	return nil
}

func (b *loopbackIdentifyUI) DisplayTrackStatement(s string) error {
	return nil
}

func (b *loopbackIdentifyUI) DisplayUserCard(c keybase1.UserCard) error {
	return nil
}

func (b *loopbackIdentifyUI) ReportTrackToken(t keybase1.TrackToken) error {
	return nil
}

func (b *loopbackIdentifyUI) Cancel() error {
	return nil
}

func (b *loopbackIdentifyUI) Finish() error {
	return nil
}

func (b *loopbackIdentifyUI) DisplayTLFCreateWithInvite(d keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}

func (b *loopbackIdentifyUI) Dismiss(s string, r keybase1.DismissReason) error {
	return nil
}
