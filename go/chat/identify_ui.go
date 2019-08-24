package chat

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type chatNullIdentifyUI struct{}

var _ libkb.IdentifyUI = chatNullIdentifyUI{}

func (c chatNullIdentifyUI) Start(libkb.MetaContext, string, keybase1.IdentifyReason, bool) error {
	return nil
}
func (c chatNullIdentifyUI) FinishWebProofCheck(libkb.MetaContext, keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (c chatNullIdentifyUI) FinishSocialProofCheck(libkb.MetaContext, keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (c chatNullIdentifyUI) Confirm(libkb.MetaContext, *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, nil
}
func (c chatNullIdentifyUI) DisplayCryptocurrency(libkb.MetaContext, keybase1.Cryptocurrency) error {
	return nil
}
func (c chatNullIdentifyUI) DisplayStellarAccount(libkb.MetaContext, keybase1.StellarAccount) error {
	return nil
}
func (c chatNullIdentifyUI) DisplayKey(libkb.MetaContext, keybase1.IdentifyKey) error { return nil }
func (c chatNullIdentifyUI) ReportLastTrack(libkb.MetaContext, *keybase1.TrackSummary) error {
	return nil
}
func (c chatNullIdentifyUI) LaunchNetworkChecks(libkb.MetaContext, *keybase1.Identity, *keybase1.User) error {
	return nil
}
func (c chatNullIdentifyUI) DisplayTrackStatement(libkb.MetaContext, string) error         { return nil }
func (c chatNullIdentifyUI) DisplayUserCard(libkb.MetaContext, keybase1.UserCard) error    { return nil }
func (c chatNullIdentifyUI) ReportTrackToken(libkb.MetaContext, keybase1.TrackToken) error { return nil }
func (c chatNullIdentifyUI) Cancel(libkb.MetaContext) error                                { return nil }
func (c chatNullIdentifyUI) Finish(libkb.MetaContext) error                                { return nil }
func (c chatNullIdentifyUI) DisplayTLFCreateWithInvite(libkb.MetaContext, keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}
func (c chatNullIdentifyUI) Dismiss(libkb.MetaContext, string, keybase1.DismissReason) error {
	return nil
}
