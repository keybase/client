// Tests for the PGPKeyfinder engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func TestPGPKeyfinder(t *testing.T) {
	tc := SetupEngineTest(t, "PGPKeyfinder")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	// track alice before starting so we have a user already tracked
	trackAlice(tc, u)
	defer untrackAlice(tc, u)

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}
	arg := &PGPKeyfinderArg{
		Users:     []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		SkipTrack: true,
	}
	eng := NewPGPKeyfinder(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}

func TestPGPKeyfinderLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "PGPKeyfinder")
	defer tc.Cleanup()

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	ctx := &Context{IdentifyUI: trackUI, SecretUI: &libkb.TestSecretUI{}}
	arg := &PGPKeyfinderArg{
		Users: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
	}
	eng := NewPGPKeyfinder(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}

type idLubaUI struct{}

func (u *idLubaUI) FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult)    {}
func (u *idLubaUI) FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) {}
func (u *idLubaUI) Confirm(*keybase1.IdentifyOutcome) (confirmed bool, err error)         { return }
func (u *idLubaUI) DisplayCryptocurrency(keybase1.Cryptocurrency)                         {}
func (u *idLubaUI) ReportLastTrack(*keybase1.TrackSummary)                                {}
func (u *idLubaUI) Start(string)                                                          {}
func (u *idLubaUI) LaunchNetworkChecks(*keybase1.Identity, *keybase1.User)                {}
func (u *idLubaUI) DisplayTrackStatement(string) error                                    { return nil }
func (u *idLubaUI) SetStrict(b bool)                                                      {}
