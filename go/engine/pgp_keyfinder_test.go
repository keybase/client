// Tests for the PGPKeyfinder engine.

package engine

import (
	"testing"

	keybase_1 "github.com/keybase/client/protocol/go"
)

func TestPGPKeyfinder(t *testing.T) {
	tc := SetupEngineTest(t, "PGPKeyfinder")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")
	// track alice before starting so we have a user already tracked
	_, _, err := runTrack(u, "t_alice")
	if err != nil {
		t.Fatal(err)
	}

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
		Fapr:   keybase_1.FinishAndPromptRes{TrackRemote: true},
	}

	// ctx := &Context{IdentifyUI: &idLubaUI{}, TrackUI: trackUI, SecretUI: u.NewSecretUI()}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}
	arg := &PGPKeyfinderArg{
		Users: []string{"t_alice", "kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
	}
	eng := NewPGPKeyfinder(arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

type idLubaUI struct{}

func (u *idLubaUI) FinishWebProofCheck(keybase_1.RemoteProof, keybase_1.LinkCheckResult)    {}
func (u *idLubaUI) FinishSocialProofCheck(keybase_1.RemoteProof, keybase_1.LinkCheckResult) {}
func (u *idLubaUI) FinishAndPrompt(*keybase_1.IdentifyOutcome) (res keybase_1.FinishAndPromptRes, err error) {
	return
}
func (u *idLubaUI) DisplayCryptocurrency(keybase_1.Cryptocurrency)           {}
func (u *idLubaUI) DisplayKey(keybase_1.FOKID, *keybase_1.TrackDiff)         {}
func (u *idLubaUI) ReportLastTrack(*keybase_1.TrackSummary)                  {}
func (u *idLubaUI) Start(string)                                             {}
func (u *idLubaUI) LaunchNetworkChecks(*keybase_1.Identity, *keybase_1.User) {}
func (u *idLubaUI) DisplayTrackStatement(string) error                       { return nil }
func (u *idLubaUI) SetStrict(b bool)                                         {}
