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

func SetupTestWithInsecureTriplesec(tb libkb.TestingTB, name string) (tc libkb.TestContext) {
	// SetupTest ignores the depth argument, so we can safely pass 0.
	tc = externalstest.SetupTest(tb, name, 0)

	// use an insecure triplesec in tests
	installInsecureTriplesec(tc.G)

	return tc
}

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

type fakeSaltpackUI struct{}

var _ libkb.SaltpackUI = fakeSaltpackUI{}

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
	tc := SetupTestWithInsecureTriplesec(t, "SysSpckEncDecTeam")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	msg := "this message will be encrypted for a team"

	_, teamName := createTeam(tc)
	_, err = teams.AddMember(context.TODO(), tc.G, teamName, u1.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis2 := libkb.UIs{IdentifyUI: trackUI, SecretUI: u2.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &engine.SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			TeamRecipients: []string{teamName},
			UseEntityKeys:  true,
			NoSelfEncrypt:  true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	eng := engine.NewSaltpackEncrypt(arg, saltpackkeys.NewSaltpackRecipientKeyfinderEngineAsInterface)
	m2 := libkb.NewMetaContextForTest(tc).WithUIs(uis2)
	if err := engine.RunEngine2(m2, eng); err != nil {
		t.Fatal(err)
	}

	out := sink.String()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	t.Logf("encrypted data: %s", out)

	// switch to another team member and decrypt
	kbtest.Logout(tc)
	err = u1.Login(tc.G)
	require.NoError(t, err)
	uis1 := libkb.UIs{IdentifyUI: trackUI, SecretUI: u1.NewSecretUI(), SaltpackUI: fakeSaltpackUI{}}
	m1 := libkb.NewMetaContextForTest(tc).WithUIs(uis1)

	decoded := libkb.NewBufferCloser()
	decarg := &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m1))
	if err := engine.RunEngine2(m1, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	require.Equal(t, msg, decmsg)
}

func TestSaltpackEncryptDecryptWithEntityKeysForTeams(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	u1 := tt.addUser("u1sp")
	u2 := tt.addUser("u2sp")
	u3 := tt.addUser("u3sp")

	// u2 creates the team, and adds u1
	team := u2.createTeam()
	u2.addTeamMember(team, u1.username, keybase1.TeamRole_WRITER)

	msg := "this message will be encrypted for a team"

	sink := libkb.NewBufferCloser()
	arg := &engine.SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			TeamRecipients: []string{team},
			NoSelfEncrypt:  true,
			UseEntityKeys:  true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis1 := libkb.UIs{IdentifyUI: trackUI, SecretUI: u1.newSecretUI(), SaltpackUI: fakeSaltpackUI{}}
	eng := engine.NewSaltpackEncrypt(arg, saltpackkeys.NewSaltpackRecipientKeyfinderEngineAsInterface)
	m1 := libkb.NewMetaContextForTest(*u1.tc).WithUIs(uis1)
	if err := engine.RunEngine2(m1, eng); err != nil {
		t.Fatal(err)
	}

	out := sink.String()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	t.Logf("encrypted data: %s", out)

	// u1 can decrypt
	decoded := libkb.NewBufferCloser()
	decarg := &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec1 := engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m1))
	if err := engine.RunEngine2(m1, dec1); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	require.Equal(t, msg, decmsg)

	// u2 can decrypt
	uis2 := libkb.UIs{IdentifyUI: trackUI, SecretUI: u2.newSecretUI(), SaltpackUI: fakeSaltpackUI{}}
	m2 := libkb.NewMetaContextForTest(*u2.tc).WithUIs(uis2)

	decoded2 := libkb.NewBufferCloser()
	decarg = &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded2,
	}
	dec2 := engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m2))
	if err := engine.RunEngine2(m2, dec2); err != nil {
		t.Fatal(err)
	}
	decmsg = decoded2.String()
	require.Equal(t, msg, decmsg)

	// u1 leaves team, can't decrypt
	u1.leave(team)
	teams := u1.teamList("", false, false)
	require.Len(t, teams.Teams, 0)
	decoded3 := libkb.NewBufferCloser()
	decarg = &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded3,
	}
	dec1 = engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m1))
	err := engine.RunEngine2(m1, dec1)
	require.IsType(t, libkb.DecryptionError{}, err)
	x, _ := err.(libkb.DecryptionError)
	require.IsType(t, libkb.NoDecryptionKeyError{}, x.Cause.Err)

	// u2 can still decrypt
	teams = u2.teamList("", false, false)
	require.Len(t, teams.Teams, 1)
	decoded4 := libkb.NewBufferCloser()
	decarg = &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded4,
	}
	dec2 = engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m2))
	if err := engine.RunEngine2(m2, dec2); err != nil {
		t.Fatal(err)
	}
	decmsg = decoded4.String()
	require.Equal(t, msg, decmsg)

	// u2 adds u3, can decrypt
	u2.addTeamMember(team, u3.username, keybase1.TeamRole_WRITER)
	uis3 := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.newSecretUI(), SaltpackUI: fakeSaltpackUI{}}
	m3 := libkb.NewMetaContextForTest(*u3.tc).WithUIs(uis3)

	decoded5 := libkb.NewBufferCloser()
	decarg = &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded5,
	}
	dec3 := engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m3))
	if err := engine.RunEngine2(m3, dec3); err != nil {
		t.Fatal(err)
	}
	decmsg = decoded5.String()
	require.Equal(t, msg, decmsg)
}

func TestSaltpackEncryptDecryptForImplicitTeams(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// u1 will send a message to u2@rooter (before u2 proves rooter)
	u1 := tt.addUser("u1sp")
	u2 := tt.addUser("u2sp")

	msg := "this message will be encrypted for an implicit team"

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis1 := libkb.UIs{IdentifyUI: trackUI, SecretUI: u1.newSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &engine.SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients:    []string{(u2.username + "@rooter")},
			UseEntityKeys: true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	eng := engine.NewSaltpackEncrypt(arg, saltpackkeys.NewSaltpackRecipientKeyfinderEngineAsInterface)
	m1 := libkb.NewMetaContextForTest(*u1.tc).WithUIs(uis1)
	if err := engine.RunEngine2(m1, eng); err != nil {
		t.Fatal(err)
	}

	out := sink.String()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	t.Logf("encrypted data: %s", out)

	// u2 has not proven rooter yet, they should not be able to decrypt
	uis2 := libkb.UIs{IdentifyUI: trackUI, SecretUI: u2.newSecretUI(), SaltpackUI: fakeSaltpackUI{}}
	m2 := libkb.NewMetaContextForTest(*u2.tc).WithUIs(uis2)

	decoded := libkb.NewBufferCloser()
	decarg := &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m2))
	err := engine.RunEngine2(m2, dec)
	require.IsType(t, libkb.DecryptionError{}, err)
	x, _ := err.(libkb.DecryptionError)
	require.IsType(t, libkb.NoDecryptionKeyError{}, x.Cause.Err)

	// Get current implicit team seqno so we can wait for it to be updated later
	team, _, _, err := teams.LookupImplicitTeam(context.Background(), u1.tc.G, u1.username+","+u2.username+"@rooter", false, teams.ImplicitTeamOptions{})
	require.NoError(t, err)
	nextSeqno := team.NextSeqno()

	u2.proveRooter()

	//Wait for u1 to add u2 to the implicit team
	u2.kickTeamRekeyd()
	u2.waitForTeamChangedGregor(team.ID, nextSeqno)

	// Now decryption should succeed
	decoded = libkb.NewBufferCloser()
	decarg = &engine.SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec = engine.NewSaltpackDecrypt(decarg, saltpackkeys.NewKeyPseudonymResolver(m2))
	if err := engine.RunEngine2(m2, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	require.Equal(t, msg, decmsg)
}
