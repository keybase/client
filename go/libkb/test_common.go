// +build !production

package libkb

import (
	"io/ioutil"
	"os"
	"path"
	"sync"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
)

// TestConfig tracks libkb config during a test
type TestConfig struct {
	configFileName string
}

func (c *TestConfig) GetConfigFileName() string { return c.configFileName }

func (c *TestConfig) InitTest(t *testing.T, initConfig string) {
	G.Log = logger.NewTestLogger(t)
	G.Init()

	var f *os.File
	var err error
	if f, err = ioutil.TempFile(os.TempDir(), "testconfig"); err != nil {
		t.Fatalf("couldn't create temp file: %s", err)
	}
	c.configFileName = f.Name()
	if _, err = f.WriteString(initConfig); err != nil {
		t.Fatalf("couldn't write config file: %s", err)
	}
	f.Close()

	// XXX: The global G prevents us from running tests in parallel
	G.Env.Test.ConfigFilename = c.configFileName

	if err = G.ConfigureConfig(); err != nil {
		t.Fatalf("couldn't configure the config: %s", err)
	}
}

func (c *TestConfig) CleanTest() {
	if c.configFileName != "" {
		os.Remove(c.configFileName)
	}
}

// TestOutput is a mock interface for capturing and testing output
type TestOutput struct {
	expected string
	t        *testing.T
	called   *bool
}

func NewTestOutput(e string, t *testing.T, c *bool) TestOutput {
	return TestOutput{e, t, c}
}

func (to TestOutput) Write(p []byte) (n int, err error) {
	output := string(p)
	if to.expected != output {
		to.t.Errorf("Expected output %s, got %s", to.expected, output)
	}
	*to.called = true
	return len(p), nil
}

type TestContext struct {
	G          *GlobalContext
	PrevGlobal *GlobalContext
	Tp         TestParameters
	// TODO: Rename this to TB.
	T testing.TB
}

func (tc *TestContext) Cleanup() {
	if len(tc.Tp.Home) > 0 {
		tc.G.Log.Debug("global context shutdown:")
		tc.G.Log.Debug("cleaning up %s", tc.Tp.Home)
		tc.G.Shutdown()
		tc.G.Log.Debug("cleaning up %s", tc.Tp.Home)
		os.RemoveAll(tc.Tp.Home)
		tc.G.Log.Debug("clearing stored secrets:")
		tc.ClearAllStoredSecrets()
	}
	tc.G.Log.Debug("cleanup complete")
}

func (tc TestContext) MoveGpgKeyringTo(dst TestContext) error {

	mv := func(f string) (err error) {
		return os.Rename(path.Join(tc.Tp.GPGHome, f), path.Join(dst.Tp.GPGHome, f))
	}

	if err := mv("secring.gpg"); err != nil {
		return err
	}
	if err := mv("pubring.gpg"); err != nil {
		return err
	}
	return nil
}

func (tc *TestContext) GenerateGPGKeyring(ids ...string) error {
	tc.T.Logf("generating gpg keyring in %s", tc.Tp.GPGHome)
	fsk, err := os.Create(path.Join(tc.Tp.GPGHome, "secring.gpg"))
	if err != nil {
		return err
	}
	defer fsk.Close()
	fpk, err := os.Create(path.Join(tc.Tp.GPGHome, "pubring.gpg"))
	if err != nil {
		return err
	}
	defer fpk.Close()

	for _, id := range ids {
		bundle, err := tc.MakePGPKey(id)
		if err != nil {
			return err
		}

		err = bundle.Entity.SerializePrivate(fsk, nil)
		if err != nil {
			return err
		}

		err = bundle.Entity.Serialize(fpk)
		if err != nil {
			return err
		}
	}

	return nil
}

func (tc *TestContext) MakePGPKey(id string) (*PGPKeyBundle, error) {
	arg := PGPGenArg{
		PrimaryBits: 1024,
		SubkeyBits:  1024,
		PGPUids:     []string{id},
	}
	arg.Init()
	arg.CreatePGPIDs()
	return GeneratePGPKeyBundle(arg, tc.G.UI.GetLogUI())
}

// ResetLoginStateForTest simulates a shutdown and restart (for client
// state). Used by tests that need to clear out cached login state
// without logging out.
func (tc *TestContext) ResetLoginState() {
	tc.G.createLoginState()
}

func (tc TestContext) ClearAllStoredSecrets() error {
	usernames, err := GetUsersWithStoredSecrets()
	if err != nil {
		return err
	}
	for _, username := range usernames {
		nu := NewNormalizedUsername(username)
		err = ClearStoredSecret(nu)
		if err != nil {
			return err
		}
	}
	return nil
}

var setupTestMu sync.Mutex

func setupTestContext(tb testing.TB, nm string, tcPrev *TestContext) (tc TestContext, err error) {
	setupTestMu.Lock()
	defer setupTestMu.Unlock()

	g := NewGlobalContext()

	// In debugging mode, dump all log, don't use the test logger.
	// We only use the environment variable to discover debug mode
	if val, _ := getEnvBool("KEYBASE_DEBUG"); !val {
		g.Log = logger.NewTestLogger(tb)
	}

	g.Init()
	g.Log.Debug("SetupTest %s", nm)

	// Set up our testing parameters.  We might add others later on
	if tcPrev != nil {
		tc.Tp = tcPrev.Tp
	} else if tc.Tp.Home, err = ioutil.TempDir(os.TempDir(), nm); err != nil {
		return
	}

	// might as well be the same directory...
	tc.Tp.GPGHome = tc.Tp.Home
	tc.Tp.GPGOptions = []string{"--homedir=" + tc.Tp.GPGHome}

	tc.Tp.Debug = false
	tc.Tp.Devel = true

	g.Env.Test = tc.Tp

	g.ConfigureLogging()

	if err = g.ConfigureAPI(); err != nil {
		return
	}

	// use stub engine for external api
	g.XAPI = NewStubAPIEngine()

	if err = g.ConfigureConfig(); err != nil {
		return
	}
	if err = g.ConfigureTimers(); err != nil {
		return
	}
	if err = g.ConfigureCaches(); err != nil {
		return
	}
	if err = g.ConfigureMerkleClient(); err != nil {
		return
	}
	g.UI = &nullui{gctx: g}
	if err = g.UI.Configure(); err != nil {
		return
	}
	if err = g.ConfigureKeyring(); err != nil {
		return
	}

	tc.PrevGlobal = G
	G = g
	tc.G = g
	tc.T = tb

	return
}

func SetupTest(tb testing.TB, nm string) (tc TestContext) {
	var err error
	tc, err = setupTestContext(tb, nm, nil)
	if err != nil {
		tb.Fatal(err)
	}
	return tc
}

func (tc *TestContext) SetSocketFile(s string) {
	tc.Tp.SocketFile = s
	tc.G.Env.Test.SocketFile = s
}

func (tc TestContext) Clone() (ret TestContext) {
	var err error
	ret, err = setupTestContext(tc.T, "", &tc)
	if err != nil {
		tc.T.Fatal(err)
	}
	return ret
}

type nullui struct {
	gctx *GlobalContext
}

func (n *nullui) GetDoctorUI() DoctorUI {
	return nil
}
func (n *nullui) GetIdentifyUI() IdentifyUI {
	return nil
}
func (n *nullui) GetIdentifySelfUI() IdentifyUI {
	return nil
}
func (n *nullui) GetIdentifyTrackUI(strict bool) IdentifyUI {
	return nil
}
func (n *nullui) GetLoginUI() LoginUI {
	return nil
}
func (n *nullui) GetTerminalUI() TerminalUI {
	return nil
}
func (n *nullui) GetSecretUI() SecretUI {
	return nil
}
func (n *nullui) GetProveUI() ProveUI {
	return nil
}
func (n *nullui) GetGPGUI() GPGUI {
	return nil
}
func (n *nullui) GetLogUI() LogUI {
	return n.gctx.Log
}
func (n *nullui) GetLocksmithUI() LocksmithUI {
	return nil
}
func (n *nullui) GetProvisionUI(bool) ProvisionUI {
	return nil
}
func (n *nullui) Prompt(string, bool, Checker) (string, error) {
	return "", nil
}
func (n *nullui) GetIdentifyLubaUI() IdentifyUI {
	return nil
}
func (n *nullui) Configure() error {
	return nil
}
func (n *nullui) Shutdown() error {
	return nil
}

type TestSecretUI struct {
	Passphrase             string
	BackupPassphrase       string
	StoreSecret            bool
	CalledGetSecret        bool
	CalledGetKBPassphrase  bool
	CalledGetBUPassphrase  bool
	CalledGetNewPassphrase bool
}

func (t *TestSecretUI) GetSecret(p keybase1.SecretEntryArg, terminal *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	t.CalledGetSecret = true
	return &keybase1.SecretEntryRes{
		Text:        t.Passphrase,
		Canceled:    false,
		StoreSecret: p.UseSecretStore && t.StoreSecret,
	}, nil
}

func (t *TestSecretUI) GetNewPassphrase(keybase1.GetNewPassphraseArg) (keybase1.GetNewPassphraseRes, error) {
	t.CalledGetNewPassphrase = true
	return keybase1.GetNewPassphraseRes{Passphrase: t.Passphrase}, nil
}

func (t *TestSecretUI) GetKeybasePassphrase(keybase1.GetKeybasePassphraseArg) (string, error) {
	t.CalledGetKBPassphrase = true
	return t.Passphrase, nil
}

func (t *TestSecretUI) GetPaperKeyPassphrase(keybase1.GetPaperKeyPassphraseArg) (string, error) {
	t.CalledGetBUPassphrase = true
	return t.BackupPassphrase, nil
}

type TestLoginUI struct {
	Username     string
	RevokeBackup bool
}

func (t TestLoginUI) GetEmailOrUsername(_ context.Context, _ int) (string, error) {
	return t.Username, nil
}

func (t TestLoginUI) PromptRevokePaperKeys(_ context.Context, arg keybase1.PromptRevokePaperKeysArg) (bool, error) {
	return t.RevokeBackup, nil
}

func (t TestLoginUI) DisplayPaperKeyPhrase(_ context.Context, arg keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}

func (t TestLoginUI) DisplayPrimaryPaperKey(_ context.Context, arg keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}
