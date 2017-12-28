// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package libkb

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// TestConfig tracks libkb config during a test
type TestConfig struct {
	configFileName string
}

func (c *TestConfig) GetConfigFileName() string { return c.configFileName }

// TestingTB is a copy of the exported parts of testing.TB. We define
// this in order to avoid pulling in the "testing" package in exported
// code.
type TestingTB interface {
	Error(args ...interface{})
	Errorf(format string, args ...interface{})
	Fail()
	FailNow()
	Failed() bool
	Fatal(args ...interface{})
	Fatalf(format string, args ...interface{})
	Log(args ...interface{})
	Logf(format string, args ...interface{})
	Name() string
	Skip(args ...interface{})
	SkipNow()
	Skipf(format string, args ...interface{})
	Skipped() bool
	Helper()
}

func MakeThinGlobalContextForTesting(t TestingTB) *GlobalContext {
	g := NewGlobalContext().Init()
	g.Log = logger.NewTestLogger(t)
	return g
}

func makeLogGetter(t TestingTB) func() logger.Logger {
	return func() logger.Logger { return logger.NewTestLogger(t) }
}

func (c *TestConfig) CleanTest() {
	if c.configFileName != "" {
		os.Remove(c.configFileName)
	}
}

// TestOutput is a mock interface for capturing and testing output
type TestOutput struct {
	expected string
	t        TestingTB
	called   *bool
}

func NewTestOutput(e string, t TestingTB, c *bool) TestOutput {
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
	Tp         *TestParameters
	// TODO: Rename this to TB.
	T TestingTB
}

func (tc *TestContext) Cleanup() {
	tc.G.Log.Debug("global context shutdown:")
	tc.G.Shutdown()
	if len(tc.Tp.Home) > 0 {
		tc.G.Log.Debug("cleaning up %s", tc.Tp.Home)
		os.RemoveAll(tc.Tp.Home)
		tc.G.Log.Debug("clearing stored secrets:")
		tc.ClearAllStoredSecrets()
	}
	tc.G.Log.Debug("cleanup complete")
}

func (tc TestContext) MoveGpgKeyringTo(dst TestContext) error {

	mv := func(f string) (err error) {
		return os.Rename(path.Join(tc.Tp.GPGHome, f), filepath.Join(dst.Tp.GPGHome, f))
	}

	if err := mv("secring.gpg"); err != nil {
		return err
	}
	return mv("pubring.gpg")
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
	return GeneratePGPKeyBundle(tc.G, arg, tc.G.UI.GetLogUI())
}

// ResetLoginStateForTest simulates a shutdown and restart (for client
// state). Used by tests that need to clear out cached login state
// without logging out.
func (tc *TestContext) ResetLoginState() {
	tc.G.createLoginState()
}

func (tc TestContext) ClearAllStoredSecrets() error {
	usernames, err := tc.G.GetUsersWithStoredSecrets()
	if err != nil {
		return err
	}
	for _, username := range usernames {
		nu := NewNormalizedUsername(username)
		err = ClearStoredSecret(tc.G, nu)
		if err != nil {
			return err
		}
	}
	return nil
}

var setupTestMu sync.Mutex

func setupTestContext(tb TestingTB, name string, tcPrev *TestContext) (tc TestContext, err error) {
	setupTestMu.Lock()
	defer setupTestMu.Unlock()
	tc.Tp = &TestParameters{}

	g := NewGlobalContext()

	// In debugging mode, dump all log, don't use the test logger.
	// We only use the environment variable to discover debug mode
	if val, _ := getEnvBool("KEYBASE_DEBUG"); !val {
		g.Log = logger.NewTestLogger(tb)
	}

	buf := make([]byte, 5)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	// Uniquify name, since multiple tests may use the same name.
	name = fmt.Sprintf("%s_%s", name, hex.EncodeToString(buf))

	g.Init()
	g.Log.Debug("SetupTest %s", name)

	// Set up our testing parameters.  We might add others later on
	if tcPrev != nil {
		tc.Tp = tcPrev.Tp
	} else if tc.Tp.Home, err = ioutil.TempDir(os.TempDir(), name); err != nil {
		return
	}

	g.Log.Debug("SetupTest home directory: %s", tc.Tp.Home)

	// might as well be the same directory...
	tc.Tp.GPGHome = tc.Tp.Home
	tc.Tp.GPGOptions = []string{"--homedir=" + tc.Tp.GPGHome}

	tc.Tp.Debug = false
	tc.Tp.Devel = true
	tc.Tp.DevelName = name

	g.Env.Test = tc.Tp

	// SecretStoreFile needs test home directory
	g.SecretStoreAll = NewSecretStoreLocked(g)

	g.ConfigureLogging()

	if err = g.ConfigureAPI(); err != nil {
		return
	}

	// use stub engine for external api
	g.XAPI = NewStubAPIEngine(g)

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

	g.GregorDismisser = &FakeGregorDismisser{}
	g.SetUIDMapper(NewTestUIDMapper(g.GetUPAKLoader()))
	tc.G = g
	tc.T = tb

	if g.SecretStoreAll == nil {
		g.SecretStoreAll = &SecretStoreLocked{SecretStoreAll: NewTestSecretStoreAll(g, g)}
	}

	return
}

// The depth argument is now ignored.
func SetupTest(tb TestingTB, name string, depth int) (tc TestContext) {
	var err error
	tc, err = setupTestContext(tb, name, nil)
	if err != nil {
		tb.Fatal(err)
	}
	if os.Getenv("KEYBASE_LOG_SETUPTEST_FUNCS") != "" {
		depth := 0
		// Walk up the stackframe looking for the function that starts with "Test".
		for {
			pc, file, line, ok := runtime.Caller(depth)
			if ok {
				fn := runtime.FuncForPC(pc)
				fnName := filepath.Base(fn.Name())
				if !strings.Contains(fnName, ".Test") {
					// Not the right frame. Bump depth and loop again.
					depth++
					continue
				}
				// This is the right frame.
				fmt.Fprintf(os.Stderr, "- SetupTest %s %s:%d\n", filepath.Base(fn.Name()), filepath.Base(file), line)
			} else {
				// We've walked off the end of the stack without finding what we were looking for.
				fmt.Fprintf(os.Stderr, "- SetupTest FAILED TO GET STACKFRAME")
			}
			break
		}
	}
	return tc
}

func (tc *TestContext) SetRuntimeDir(s string) {
	tc.Tp.RuntimeDir = s
	tc.G.Env.Test.RuntimeDir = s
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

func (n *nullui) Printf(f string, args ...interface{}) (int, error) {
	return fmt.Printf(f, args...)
}

func (n *nullui) PrintfStderr(f string, args ...interface{}) (int, error) {
	return fmt.Fprintf(os.Stderr, f, args...)
}

func (n *nullui) GetDumbOutputUI() DumbOutputUI {
	return n
}

func (n *nullui) GetIdentifyUI() IdentifyUI {
	return nil
}
func (n *nullui) GetIdentifyTrackUI() IdentifyUI {
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
func (n *nullui) GetPgpUI() PgpUI {
	return nil
}
func (n *nullui) GetProvisionUI(KexRole) ProvisionUI {
	return nil
}
func (n *nullui) Prompt(string, bool, Checker) (string, error) {
	return "", nil
}
func (n *nullui) PromptForConfirmation(prompt string) error {
	return nil
}
func (n *nullui) Configure() error {
	return nil
}
func (n *nullui) Shutdown() error {
	return nil
}

type TestSecretUI struct {
	Passphrase          string
	StoreSecret         bool
	CalledGetPassphrase bool
}

func (t *TestSecretUI) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	t.CalledGetPassphrase = true
	return keybase1.GetPassphraseRes{
		Passphrase:  t.Passphrase,
		StoreSecret: t.StoreSecret,
	}, nil
}

type TestCancelSecretUI struct {
	CallCount int
}

func (t *TestCancelSecretUI) GetPassphrase(_ keybase1.GUIEntryArg, _ *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	t.CallCount++
	return keybase1.GetPassphraseRes{}, InputCanceledError{}
}

type TestCountSecretUI struct {
	Passphrase  string
	StoreSecret bool
	CallCount   int
}

func (t *TestCountSecretUI) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	t.CallCount++
	return keybase1.GetPassphraseRes{
		Passphrase:  t.Passphrase,
		StoreSecret: t.StoreSecret,
	}, nil
}

type TestLoginUI struct {
	Username                 string
	RevokeBackup             bool
	CalledGetEmailOrUsername int
}

func (t *TestLoginUI) GetEmailOrUsername(_ context.Context, _ int) (string, error) {
	t.CalledGetEmailOrUsername++
	return t.Username, nil
}

func (t *TestLoginUI) PromptRevokePaperKeys(_ context.Context, arg keybase1.PromptRevokePaperKeysArg) (bool, error) {
	return t.RevokeBackup, nil
}

func (t *TestLoginUI) DisplayPaperKeyPhrase(_ context.Context, arg keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}

func (t *TestLoginUI) DisplayPrimaryPaperKey(_ context.Context, arg keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}

type TestLoginCancelUI struct {
	TestLoginUI
}

func (t *TestLoginCancelUI) GetEmailOrUsername(_ context.Context, _ int) (string, error) {
	return "", InputCanceledError{}
}

type FakeGregorDismisser struct {
	dismissedIDs []gregor.MsgID
}

var _ GregorDismisser = (*FakeGregorDismisser)(nil)

func (f *FakeGregorDismisser) DismissItem(_ context.Context, cli gregor1.IncomingInterface, id gregor.MsgID) error {
	f.dismissedIDs = append(f.dismissedIDs, id)
	return nil
}

func (f *FakeGregorDismisser) LocalDismissItem(ctx context.Context, id gregor.MsgID) error {
	return nil
}

// ResetLoginState is only used for testing...
// Bypasses locks.
func (g *GlobalContext) ResetLoginState() {
	g.createLoginStateLocked()
}

type TestUIDMapper struct {
	ul UPAKLoader
}

func NewTestUIDMapper(ul UPAKLoader) TestUIDMapper {
	return TestUIDMapper{
		ul: ul,
	}
}

func (t TestUIDMapper) ClearUIDAtEldestSeqno(_ context.Context, _ UIDMapperContext, _ keybase1.UID, _ keybase1.Seqno) error {
	return nil
}

func (t TestUIDMapper) CheckUIDAgainstUsername(uid keybase1.UID, un NormalizedUsername) bool {
	return true
}

func (t TestUIDMapper) InformOfEldestSeqno(ctx context.Context, g UIDMapperContext, uv keybase1.UserVersion) (bool, error) {
	return true, nil
}

func (t TestUIDMapper) MapUIDsToUsernamePackages(ctx context.Context, g UIDMapperContext, uids []keybase1.UID, fullNameFreshness time.Duration, networkTimeBudget time.Duration, forceNetworkForFullNames bool) ([]UsernamePackage, error) {
	var res []UsernamePackage
	for _, uid := range uids {
		name, err := t.ul.LookupUsernameUPAK(ctx, uid)
		if err != nil {
			return nil, err
		}
		res = append(res, UsernamePackage{NormalizedUsername: name})
	}
	return res, nil
}

func (t TestUIDMapper) SetTestingNoCachingMode(enabled bool) {

}
