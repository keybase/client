
package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
)

type IdentifyResOrError struct {
	body *keybase_1.IdentifyStartResBody
	err error
}

type CheckResChan chan keybase_1.IdentifyCheckResBody

type RemoteTrackUI struct {
	them *libkb.User
	body keybase_1.IdentifyStartResBody
	ch chan IdentifyResOrError
	checks []CheckResChan
}

func NewRemoteTrackUI(u *libkb.User) *RemoteTrackUI {
	return &RemoteTrackUI{
		them : u,
		ch : make(chan IdentifyResOrError),
	}
}

func (u *RemoteTrackUI) FinishWebProofCheck(link *libkb.WebProofChainLink, lcr libkb.LinkCheckResult) {
	u.checks[lcr.GetPosition()] <- lcr.ExportToIdentifyCheckResBody()
	return
}
func (u *RemoteTrackUI) FinishSocialProofCheck(link *libkb.SocialProofChainLink, lcr libkb.LinkCheckResult) {
	u.checks[lcr.GetPosition()] <- lcr.ExportToIdentifyCheckResBody()
	return
}
func (u *RemoteTrackUI) FinishAndPrompt(*libkb.IdentifyRes) (ti libkb.TrackInstructions, err error) {
	return
}
func (u *RemoteTrackUI) DisplayCryptocurrency(*libkb.CryptocurrencyChainLink) {
	return
}
func (u *RemoteTrackUI) DisplayKey(k *libkb.PgpFingerprint, diff libkb.TrackDiff) {
	if k != nil {
		u.body.Key.PgpFingerprint = (*k)[:]
	}
	u.body.Key.TrackDiff = libkb.ExportTrackDiff(diff)
	return
}
func (u *RemoteTrackUI) ReportLastTrack(l *libkb.TrackLookup) {
	if l != nil {
		u.body.WhenLastTracked = int(l.GetCTime().Unix())
	}
	return
}
func (u *RemoteTrackUI) Start() {
	return
}

func (u *RemoteTrackUI) LaunchNetworkChecks(res *libkb.IdentifyRes) {
	u.checks = make([]CheckResChan, len(res.ProofChecks))
	for i, r := range res.ProofChecks {
		u.body.Proofs = append(u.body.Proofs, r.ExportToIdentifyRow(i))
		u.checks[i] = make(CheckResChan)
	}
	u.ch <- IdentifyResOrError{ body : &u.body }
}
