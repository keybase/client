package chat

import "github.com/keybase/client/go/protocol/keybase1"

type chatNullIdentifyUI struct{}

func (c chatNullIdentifyUI) Start(string, keybase1.IdentifyReason, bool) error { return nil }
func (c chatNullIdentifyUI) FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (c chatNullIdentifyUI) FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (c chatNullIdentifyUI) Confirm(*keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, nil
}
func (c chatNullIdentifyUI) DisplayCryptocurrency(keybase1.Cryptocurrency) error          { return nil }
func (c chatNullIdentifyUI) DisplayStellarAccount(keybase1.StellarAccount) error          { return nil }
func (c chatNullIdentifyUI) DisplayKey(keybase1.IdentifyKey) error                        { return nil }
func (c chatNullIdentifyUI) ReportLastTrack(*keybase1.TrackSummary) error                 { return nil }
func (c chatNullIdentifyUI) LaunchNetworkChecks(*keybase1.Identity, *keybase1.User) error { return nil }
func (c chatNullIdentifyUI) DisplayTrackStatement(string) error                           { return nil }
func (c chatNullIdentifyUI) DisplayUserCard(keybase1.UserCard) error                      { return nil }
func (c chatNullIdentifyUI) ReportTrackToken(keybase1.TrackToken) error                   { return nil }
func (c chatNullIdentifyUI) Cancel() error                                                { return nil }
func (c chatNullIdentifyUI) Finish() error                                                { return nil }
func (c chatNullIdentifyUI) DisplayTLFCreateWithInvite(keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}
func (c chatNullIdentifyUI) Dismiss(string, keybase1.DismissReason) error { return nil }
