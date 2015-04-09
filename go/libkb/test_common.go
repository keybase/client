package libkb

import (
	"io/ioutil"
	"os"
	"path"
	"testing"

	keybase_1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/openpgp"
)

// TestConfig tracks libkb config during a test
type TestConfig struct {
	configFileName string
}

func (c *TestConfig) GetConfigFileName() string { return c.configFileName }

func (c *TestConfig) InitTest(t *testing.T, initConfig string) {
	G.Init()
	var f *os.File
	var err error
	if f, err = ioutil.TempFile("/tmp/", "testconfig"); err != nil {
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
	G          GlobalContext
	PrevGlobal GlobalContext
	Tp         TestParameters
	t          *testing.T
}

func (tc *TestContext) Cleanup() {
	if len(tc.Tp.Home) > 0 {
		G.Log.Debug("cleaning up %s", tc.Tp.Home)
		os.RemoveAll(tc.Tp.Home)
	}
}

func (src TestContext) MoveGpgKeyringTo(dst TestContext) error {

	mv := func(f string) (err error) {
		return os.Rename(path.Join(src.Tp.GPGHome, f), path.Join(dst.Tp.GPGHome, f))
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
	tc.t.Logf("generating gpg keyring in %s", tc.Tp.GPGHome)
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

		err = (*openpgp.Entity)(bundle).SerializePrivate(fsk, nil)
		if err != nil {
			return err
		}

		err = (*openpgp.Entity)(bundle).Serialize(fpk)
		if err != nil {
			return err
		}
	}

	return nil
}

func (tc *TestContext) MakePGPKey(id string) (*PgpKeyBundle, error) {
	arg := PGPGenArg{
		PrimaryBits: 1024,
		SubkeyBits:  1024,
		PGPUids:     []string{id},
	}
	arg.Init()
	arg.CreatePgpIDs()
	return NewPgpKeyBundle(arg, tc.G.UI.GetLogUI())
}

func setupTestContext(nm string) (tc TestContext, err error) {

	var g GlobalContext = NewGlobalContext()
	g.Init()

	// Set up our testing parameters.  We might add others later on
	if tc.Tp.Home, err = ioutil.TempDir(os.TempDir(), nm); err != nil {
		return
	}

	// might as well be the same directory...
	tc.Tp.GPGHome = tc.Tp.Home
	tc.Tp.GPGOptions = []string{"--homedir=" + tc.Tp.GPGHome}

	tc.Tp.ServerUri = "http://localhost:3000"
	tc.Tp.Debug = false
	g.Env.Test = tc.Tp

	g.ConfigureLogging()

	if err = g.ConfigureAPI(); err != nil {
		return
	}
	if err = g.ConfigureConfig(); err != nil {
		return
	}
	if err = g.ConfigureSecretSyncer(); err != nil {
		return
	}
	if err = g.ConfigureCaches(); err != nil {
		return
	}
	if err = g.ConfigureMerkleClient(); err != nil {
		return
	}
	g.UI = &nullui{}
	if err = g.UI.Configure(); err != nil {
		return
	}
	if err = g.ConfigureKeyring(); err != nil {
		return
	}

	tc.PrevGlobal = G
	G = g
	tc.G = g

	return
}

func SetupTest(t *testing.T, nm string) (tc TestContext) {
	G.Log.Debug("SetupTest %s", nm)
	var err error
	tc, err = setupTestContext(nm)
	if err != nil {
		t.Fatal(err)
	}
	tc.t = t

	return tc
}

type nullui struct{}

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
	return G.Log
}
func (n *nullui) GetLocksmithUI() LocksmithUI {
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
	Passphrase  string
	StoreSecret bool
}

func (t TestSecretUI) GetSecret(p keybase_1.SecretEntryArg, terminal *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error) {
	return &keybase_1.SecretEntryRes{
		Text:        t.Passphrase,
		Canceled:    false,
		StoreSecret: p.UseSecretStore && t.StoreSecret,
	}, nil
}

func (t TestSecretUI) GetNewPassphrase(keybase_1.GetNewPassphraseArg) (string, error) {
	return t.Passphrase, nil
}

func (t TestSecretUI) GetKeybasePassphrase(keybase_1.GetKeybasePassphraseArg) (string, error) {
	return t.Passphrase, nil
}

type TestLoginUI struct {
	Username string
}

func (t TestLoginUI) GetEmailOrUsername(dummy int) (string, error) {
	return t.Username, nil
}
