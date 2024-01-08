package updater

import (
	"io"
	"net/http"
	"time"

	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/updater/saltpack"
	"github.com/keybase/client/go/updater/util"
	"github.com/keybase/go-logging"
	"github.com/stretchr/testify/require"
)

var testLog = &logging.Logger{Module: "test"}

var testZipPath string

var testAppStatePath = filepath.Join(os.TempDir(), "KBTest_app_state.json")

const (
	// shasum -a 256 test/test.zip
	validDigest = "54970995e4d02da631e0634162ef66e2663e0eee7d018e816ac48ed6f7811c84"
	// keybase sign -d -i test.zip
	validSignature = `BEGIN KEYBASE SALTPACK DETACHED SIGNATURE.
kXR7VktZdyH7rvq v5weRa8moXPeKBe e2YLT0PnyHzCrVi RbC1J5uJtYgYyLW eGg4qzsWqkb7hcX
GTVc0vsEUVwBCly qhPdOL0mE19kfxg A4fMqpNGNTY0jtO iMpjwwuIyLBxkCC jHzMiJFskzluz2S
otWUI0nTu2vG2Fx Mgeyqm20Ug8j7Bi N. END KEYBASE SALTPACK DETACHED SIGNATURE.`
	invalidDigest    = "74970995e4d02da631e0634162ef66e2663e0eee7d018e816ac48ed6f7811c84"
	invalidSignature = `BEGIN KEYBASE SALTPACK DETACHED SIGNATURE.
	QXR7VktZdyH7rvq v5wcIkPOwDJ1n11 M8RnkLKQGO2f3Bb fzCeMYz4S6oxLAy
	Cco4N255JFzv2PX E6WWdobANV4guJI iEE8XJb6uudCX4x QWZfnamVAaZpXuW
	vdz65rE7oZsLSdW oxMsbBgG9NVpSJy x3CD6LaC9GlZ4IS ofzkHe401mHjr7M M. END
	KEYBASE SALTPACK DETACHED SIGNATURE.`
)

func makeKeybaseUpdateTempDir(t *testing.T, updater *Updater, testAsset *Asset) (tmpDir string) {
	// This creates a real KebyaseUpdater.[ID] directory in os.TempDir
	// Then we download the test zip to this directory from testServer
	tmpDir, err := util.MakeTempDir("KeybaseUpdater.", 0700)
	require.NoError(t, err)
	err = updater.downloadAsset(testAsset, tmpDir, UpdateOptions{})
	require.NoError(t, err)
	return tmpDir
}

func init() {
	_, filename, _, _ := runtime.Caller(0)
	testZipPath = filepath.Join(filepath.Dir(filename), "test/test.zip")
}

func newTestUpdater(t *testing.T) (*Updater, error) {
	return newTestUpdaterWithServer(t, nil, nil, &testConfig{})
}

func newTestUpdaterWithServer(t *testing.T, testServer *httptest.Server, update *Update, config Config) (*Updater, error) {
	return NewUpdater(testUpdateSource{testServer: testServer, config: config, update: update}, config, testLog), nil
}

func newTestContext(options UpdateOptions, cfg Config, response *UpdatePromptResponse) *testUpdateUI {
	return &testUpdateUI{options: options, cfg: cfg, response: response}
}

type testUpdateUI struct {
	options            UpdateOptions
	cfg                Config
	response           *UpdatePromptResponse
	promptErr          error
	verifyErr          error
	beforeApplyErr     error
	afterApplyErr      error
	errReported        error
	actionReported     UpdateAction
	autoUpdateReported bool
	updateReported     *Update
	successReported    bool
	isCheckCommand     bool
}

func (u testUpdateUI) BeforeUpdatePrompt(_ Update, _ UpdateOptions) error {
	return nil
}

func (u testUpdateUI) UpdatePrompt(_ Update, _ UpdateOptions, _ UpdatePromptOptions) (*UpdatePromptResponse, error) {
	if u.promptErr != nil {
		return nil, u.promptErr
	}
	return u.response, nil
}

func (u testUpdateUI) BeforeApply(update Update) error {
	return u.beforeApplyErr
}

func (u testUpdateUI) Apply(update Update, options UpdateOptions, tmpDir string) error {
	return nil
}

func (u testUpdateUI) AfterApply(update Update) error {
	return u.afterApplyErr
}

func (u testUpdateUI) GetUpdateUI() UpdateUI {
	return u
}

func (u testUpdateUI) Verify(update Update) error {
	if u.verifyErr != nil {
		return u.verifyErr
	}
	var validCodeSigningKIDs = map[string]bool{
		"0120d7539e27e83a9c8caf8701199c6985c0a96801ff7cb69456e9b3a8a8446c66080a": true, // joshblum (saltine)
	}
	return saltpack.VerifyDetachedFileAtPath(update.Asset.LocalPath, update.Asset.Signature, validCodeSigningKIDs, testLog)
}

func (u *testUpdateUI) ReportError(err error, update *Update, options UpdateOptions) {
	u.errReported = err
}

func (u *testUpdateUI) ReportAction(actionResponse UpdatePromptResponse, update *Update, options UpdateOptions) {
	u.actionReported = actionResponse.Action
	autoUpdate, _ := u.cfg.GetUpdateAuto()
	u.autoUpdateReported = autoUpdate
	u.updateReported = update
}

func (u *testUpdateUI) ReportSuccess(update *Update, options UpdateOptions) {
	u.successReported = true
	u.updateReported = update
}

func (u *testUpdateUI) AfterUpdateCheck(update *Update) {}

func (u testUpdateUI) UpdateOptions() UpdateOptions {
	return u.options
}

func (u testUpdateUI) GetAppStatePath() string {
	return testAppStatePath
}

func (u testUpdateUI) IsCheckCommand() bool {
	return u.isCheckCommand
}

func (u testUpdateUI) DeepClean() {}

type testUpdateSource struct {
	testServer *httptest.Server
	config     Config
	update     *Update
	findErr    error
}

func (u testUpdateSource) Description() string {
	return "Test"
}

func testUpdate(uri string) *Update {
	return newTestUpdate(uri, true)
}

func newTestUpdate(uri string, needUpdate bool) *Update {
	update := &Update{
		Version:     "1.0.1",
		Name:        "Test",
		Description: "Bug fixes",
		InstallID:   "deadbeef",
		RequestID:   "cafedead",
		NeedUpdate:  needUpdate,
	}
	if uri != "" {
		update.Asset = &Asset{
			Name:      "test.zip",
			URL:       uri,
			Digest:    validDigest,
			Signature: validSignature,
		}
	}
	return update
}

func (u testUpdateSource) FindUpdate(options UpdateOptions) (*Update, error) {
	return u.update, u.findErr
}

type testConfig struct {
	auto         bool
	autoSet      bool
	autoOverride bool
	installID    string
	err          error
}

func (c testConfig) GetUpdateAuto() (bool, bool) {
	return c.auto, c.autoSet
}

func (c *testConfig) SetUpdateAuto(b bool) error {
	c.auto = b
	c.autoSet = true
	return c.err
}

func (c *testConfig) IsLastUpdateCheckTimeRecent(d time.Duration) bool {
	return true
}

func (c *testConfig) SetLastUpdateCheckTime() {

}

// For overriding the current Auto setting
func (c testConfig) GetUpdateAutoOverride() bool {
	return c.autoOverride
}

func (c *testConfig) SetUpdateAutoOverride(auto bool) error {
	c.autoOverride = auto
	return nil
}

func (c testConfig) GetInstallID() string {
	return c.installID
}

func (c *testConfig) SetInstallID(s string) error {
	c.installID = s
	return c.err
}

func (c testConfig) GetLastAppliedVersion() string {
	return ""
}

func (c *testConfig) SetLastAppliedVersion(version string) error {
	return nil
}

func newDefaultTestUpdateOptions() UpdateOptions {
	return UpdateOptions{
		Version:         "1.0.0",
		Platform:        runtime.GOOS,
		DestinationPath: filepath.Join(os.TempDir(), "Test"),
	}
}

func testServerForUpdateFile(t *testing.T, path string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f, err := os.Open(path)
		require.NoError(t, err)
		w.Header().Set("Content-Type", "application/zip")
		_, err = io.Copy(w, f)
		require.NoError(t, err)
	}))
}

func testServerForError(t *testing.T, err error) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, err.Error(), 500)
	}))
}

func testServerNotFound(t *testing.T) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Not Found", 404)
	}))
}
