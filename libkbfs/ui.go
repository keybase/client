package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type IdentifyUI struct {
}

func (i IdentifyUI) FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) {

}

func (i IdentifyUI) FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) {

}
func (i IdentifyUI) FinishAndPrompt(ires *keybase1.IdentifyOutcome) (ti keybase1.FinishAndPromptRes, err error) {
	err = libkb.ImportStatusAsError(ires.Status)
	return
}

func (i IdentifyUI) DisplayCryptocurrency(keybase1.Cryptocurrency) {

}
func (i IdentifyUI) DisplayKey(keybase1.FOKID, *keybase1.TrackDiff) {

}
func (i IdentifyUI) ReportLastTrack(*keybase1.TrackSummary) {

}
func (i IdentifyUI) Start(username string) {

}
func (i IdentifyUI) Finish() {

}
func (i IdentifyUI) LaunchNetworkChecks(*keybase1.Identity, *keybase1.User) {

}
func (i IdentifyUI) DisplayTrackStatement(string) error {
	return nil
}

func (i IdentifyUI) SetUsername(string) {}

func (i IdentifyUI) SetStrict(b bool) {}

// A UI that's relegated to the background and can't do
// much other than output to the log
type UI struct {
}

func (ui UI) GetIdentifyUI() libkb.IdentifyUI {
	return IdentifyUI{}
}
func (ui UI) GetIdentifySelfUI() libkb.IdentifyUI {
	return IdentifyUI{}
}
func (ui UI) GetIdentifyTrackUI(strict bool) libkb.IdentifyUI {
	return IdentifyUI{}
}
func (ui UI) GetIdentifyLubaUI() libkb.IdentifyUI {
	return IdentifyUI{}
}
func (ui UI) GetLoginUI() libkb.LoginUI {
	return nil
}
func (ui UI) GetSecretUI() libkb.SecretUI {
	return nil
}
func (ui UI) GetProveUI() libkb.ProveUI {
	return nil
}
func (ui UI) GetLogUI() libkb.LogUI {
	return nil
}
func (ui UI) GetGPGUI() libkb.GPGUI {
	return nil
}
func (ui UI) GetLocksmithUI() libkb.LocksmithUI {
	return nil
}
func (ui UI) GetDoctorUI() libkb.DoctorUI {
	return nil
}
func (ui UI) Prompt(string, bool, libkb.Checker) (s string, err error) {
	err = fmt.Errorf("No UI available")
	return
}
func (ui UI) PromptForNewPassphrase(libkb.PromptArg) (s string, err error) {
	err = fmt.Errorf("No UI available")
	return
}
func (ui UI) Configure() error {
	return nil
}
func (ui UI) Shutdown() error {
	return nil
}
