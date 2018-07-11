package systests

import (
	"encoding/hex"
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/saltpackkeys"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func createTeam(tc libkb.TestContext) (keybase1.TeamID, string) {
	teams.ServiceInit(tc.G)

	b, err := libkb.RandBytes(4)
	require.NoError(tc.T, err)
	name := "t_" + hex.EncodeToString(b)
	teamID, err := teams.CreateRootTeam(context.TODO(), tc.G, name, keybase1.TeamSettings{})
	require.NoError(tc.T, err)
	require.NotNil(tc.T, teamID)

	return *teamID, name
}

// TODO this ui is duplicated from engine/saltpack_decrypt_test. Should I move to kbtests or similar?
type fakeSaltpackUI struct{}

func (s fakeSaltpackUI) SaltpackPromptForDecrypt(_ context.Context, arg keybase1.SaltpackPromptForDecryptArg, usedDelegateUI bool) (err error) {
	return nil
}

func (s fakeSaltpackUI) SaltpackVerifySuccess(_ context.Context, arg keybase1.SaltpackVerifySuccessArg) error {
	return nil
}

type FakeBadSenderError struct {
	senderType keybase1.SaltpackSenderType
}

func (e *FakeBadSenderError) Error() string {
	return fmt.Sprintf("fakeSaltpackUI bad sender error: %s", e.senderType.String())
}

func (s fakeSaltpackUI) SaltpackVerifyBadSender(_ context.Context, arg keybase1.SaltpackVerifyBadSenderArg) error {
	return &FakeBadSenderError{arg.Sender.SenderType}
}

func TestSaltpackEncryptDecryptForTeams(t *testing.T) {
	tc := externalstest.SetupTestWithInsecureTriplesec(t, "SysSaltpackEncryptDecrypt")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	msg := "this message will be encrypted for a team"

	_, teamName := createTeam(tc)
	_, err = teams.AddMember(context.TODO(), tc.G, teamName, u1.Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u2.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &engine.SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients:    []string{teamName},
			UseEntityKeys: true,
			NoSelfEncrypt: true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	eng := engine.NewSaltpackEncrypt(arg, saltpackkeys.NewSaltpackRecipientKeyfinderEngine)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	out := sink.String()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	t.Logf("encrypted data: %s", out)

	// switch to another team member and decrypt
	kbtest.Logout(tc)
	u1.Login(tc.G)
	uis = libkb.UIs{IdentifyUI: trackUI, SecretUI: u1.NewSecretUI(), SaltpackUI: fakeSaltpackUI{}}
	m = libkb.NewMetaContextForTest(tc).WithUIs(uis)

	decoded := libkb.NewBufferCloser()
	decarg := &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m))
	if err := engine.RunEngine2(m, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	if decmsg != msg {
		t.Errorf("decoded: %s, expected: %s", decmsg, msg)
	}
}
