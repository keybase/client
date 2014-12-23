
package main

import (
	"github.com/keybase/go-libkb"
)

type RemoteTrackUI struct {
	them *libkb.User
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
	return
}
func (u *RemoteTrackUI) ReportLastTrack(*libkb.TrackLookup) {
	return
}
func (u *RemoteTrackUI) Start() {
	return
}
func (u *RemoteTrackUI) LaunchNetworkChecks(*libkb.IdentifyRes) {

}
