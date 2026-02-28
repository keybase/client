// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type LoopbackIdentifyUI struct {
	libkb.Contextified
	sync.Mutex
	trackBreaksP **keybase1.IdentifyTrackBreaks
}

var _ libkb.IdentifyUI = (*LoopbackIdentifyUI)(nil)

func NewLoopbackIdentifyUI(g *libkb.GlobalContext, tb **keybase1.IdentifyTrackBreaks) *LoopbackIdentifyUI {
	return &LoopbackIdentifyUI{
		Contextified: libkb.NewContextified(g),
		trackBreaksP: tb,
	}
}

func (b *LoopbackIdentifyUI) Start(m libkb.MetaContext, s string, r keybase1.IdentifyReason, f bool) error {
	return nil
}

func (b *LoopbackIdentifyUI) trackBreaks() *keybase1.IdentifyTrackBreaks {
	if *b.trackBreaksP == nil {
		*b.trackBreaksP = &keybase1.IdentifyTrackBreaks{}
	}
	return *b.trackBreaksP
}

func (b *LoopbackIdentifyUI) FinishWebProofCheck(m libkb.MetaContext, p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
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

func (b *LoopbackIdentifyUI) FinishSocialProofCheck(m libkb.MetaContext, p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	return b.FinishWebProofCheck(m, p, l)
}

func (b *LoopbackIdentifyUI) Confirm(m libkb.MetaContext, o *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, nil
}

func (b *LoopbackIdentifyUI) DisplayCryptocurrency(m libkb.MetaContext, c keybase1.Cryptocurrency) error {
	return nil
}

func (b *LoopbackIdentifyUI) DisplayStellarAccount(libkb.MetaContext, keybase1.StellarAccount) error {
	return nil
}

func (b *LoopbackIdentifyUI) DisplayKey(m libkb.MetaContext, k keybase1.IdentifyKey) error {
	b.Lock()
	defer b.Unlock()
	if k.BreaksTracking {
		tb := b.trackBreaks()
		tb.Keys = append(tb.Keys, k)
	}
	return nil
}

func (b *LoopbackIdentifyUI) ReportLastTrack(m libkb.MetaContext, s *keybase1.TrackSummary) error {
	return nil
}

func (b *LoopbackIdentifyUI) LaunchNetworkChecks(m libkb.MetaContext, i *keybase1.Identity, u *keybase1.User) error {
	return nil
}

func (b *LoopbackIdentifyUI) DisplayTrackStatement(m libkb.MetaContext, s string) error {
	return nil
}

func (b *LoopbackIdentifyUI) DisplayUserCard(m libkb.MetaContext, c keybase1.UserCard) error {
	return nil
}

func (b *LoopbackIdentifyUI) ReportTrackToken(m libkb.MetaContext, t keybase1.TrackToken) error {
	return nil
}

func (b *LoopbackIdentifyUI) Cancel(m libkb.MetaContext) error {
	return nil
}

func (b *LoopbackIdentifyUI) Finish(m libkb.MetaContext) error {
	return nil
}

func (b *LoopbackIdentifyUI) DisplayTLFCreateWithInvite(m libkb.MetaContext, d keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}

func (b *LoopbackIdentifyUI) Dismiss(m libkb.MetaContext, s string, r keybase1.DismissReason) error {
	return nil
}
