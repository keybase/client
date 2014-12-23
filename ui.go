
package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
)

type IdentifyResOrError struct {
	body *keybase_1.IdentifyStartResBody
	err error
}

type RemoteTrackUI struct {
	them *libkb.User
	body keybase_1.IdentifyStartResBody
	ch chan IdentifyResOrError
}

func NewRemoteTrackUI(u *libkb.User) *RemoteTrackUI {
	return &RemoteTrackUI{
		them : u,
		ch : make(chan IdentifyResOrError),
	}
}

func (u *RemoteTrackUI) FinishWebProofCheck(*libkb.WebProofChainLink, libkb.LinkCheckResult) {
	return
}
func (u *RemoteTrackUI) FinishSocialProofCheck(*libkb.SocialProofChainLink, libkb.LinkCheckResult) {
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
	if diff != nil {
		d := libkb.ExportTrackDiff(diff)
		u.body.Key.TrackDiff = &d
	}
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
	u.ch <- IdentifyResOrError{ body : &u.body }
}
