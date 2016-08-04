// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import keybase1 "github.com/keybase/client/go/protocol"

// Only used for debugging until we implement identify in React-Native
type autoIdentifyUI struct{}

func (i autoIdentifyUI) Start(string, keybase1.IdentifyReason) error { return nil }
func (i autoIdentifyUI) FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (i autoIdentifyUI) FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (i autoIdentifyUI) Confirm(*keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{
		IdentityConfirmed: true,
		RemoteConfirmed:   true,
	}, nil
}
func (i autoIdentifyUI) DisplayCryptocurrency(keybase1.Cryptocurrency) error          { return nil }
func (i autoIdentifyUI) DisplayKey(keybase1.IdentifyKey) error                        { return nil }
func (i autoIdentifyUI) ReportLastTrack(*keybase1.TrackSummary) error                 { return nil }
func (i autoIdentifyUI) LaunchNetworkChecks(*keybase1.Identity, *keybase1.User) error { return nil }
func (i autoIdentifyUI) DisplayTrackStatement(string) error                           { return nil }
func (i autoIdentifyUI) DisplayUserCard(keybase1.UserCard) error                      { return nil }
func (i autoIdentifyUI) ReportTrackToken(keybase1.TrackToken) error                   { return nil }
func (i autoIdentifyUI) Finish() error                                                { return nil }
func (i autoIdentifyUI) DisplayTLFCreateWithInvite(keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}
func (i autoIdentifyUI) Dismiss(string, keybase1.DismissReason) error { return nil }
