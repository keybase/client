// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"fmt"
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
	"github.com/stretchr/testify/assert"
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

func (c *testConfig) IsLastUpdateCheckTimeRecent(_ time.Duration) bool {
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
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
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

func TestUpdaterApply(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionApply, AutoUpdate: true})
	update, err := upr.Update(ctx)
	require.NoError(t, err)
	require.NotNil(t, update)
	t.Logf("Update: %#v\n", *update)
	require.NotNil(t, update.Asset)
	t.Logf("Asset: %#v\n", *update.Asset)

	auto, autoSet := upr.config.GetUpdateAuto()
	assert.True(t, auto)
	assert.True(t, autoSet)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())

	assert.Nil(t, ctx.errReported)
	assert.Equal(t, ctx.actionReported, UpdateActionApply)
	assert.True(t, ctx.autoUpdateReported)

	require.NotNil(t, ctx.updateReported)
	assert.Equal(t, "deadbeef", ctx.updateReported.InstallID)
	assert.Equal(t, "cafedead", ctx.updateReported.RequestID)
	assert.True(t, ctx.successReported)

	assert.Equal(t, "apply", UpdateActionApply.String())
}

func TestUpdaterDownloadError(t *testing.T) {
	testServer := testServerForError(t, fmt.Errorf("bad response"))
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionApply, AutoUpdate: true})
	_, err = upr.Update(ctx)
	assert.EqualError(t, err, "Update Error (download): Responded with 500 Internal Server Error")

	require.NotNil(t, ctx.errReported)
	assert.Equal(t, ctx.errReported.(Error).errorType, DownloadError)
	assert.False(t, ctx.successReported)
}

func TestUpdaterCancel(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionCancel, AutoUpdate: true})
	_, err = upr.Update(ctx)
	assert.EqualError(t, err, "Update Error (cancel): Canceled")

	// Don't report error on user cancel
	assert.NoError(t, ctx.errReported)
}

func TestUpdaterSnooze(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionSnooze, AutoUpdate: true})
	_, err = upr.Update(ctx)
	assert.EqualError(t, err, "Update Error (cancel): Snoozed update")

	// Don't report error on user snooze
	assert.NoError(t, ctx.errReported)
}

func TestUpdaterContinue(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionContinue})
	update, err := upr.Update(ctx)
	require.NoError(t, err)
	require.NotNil(t, update)
	require.NotNil(t, update.Asset)

	auto, autoSet := upr.config.GetUpdateAuto()
	assert.False(t, auto)
	assert.False(t, autoSet)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())

	assert.Nil(t, ctx.errReported)
	assert.Empty(t, string(ctx.actionReported))
	assert.False(t, ctx.autoUpdateReported)

	require.NotNil(t, ctx.updateReported)
	assert.Equal(t, "deadbeef", ctx.updateReported.InstallID)
	assert.Equal(t, "cafedead", ctx.updateReported.RequestID)
	assert.True(t, ctx.successReported)
}

func TestUpdateNoResponse(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, nil)
	_, err = upr.Update(ctx)
	assert.EqualError(t, err, "Update Error (prompt): No response")

	require.NotNil(t, ctx.errReported)
	assert.Equal(t, ctx.errReported.(Error).errorType, PromptError)
	assert.False(t, ctx.successReported)
}

func TestUpdateNoAsset(t *testing.T) {
	testServer := testServerNotFound(t)
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate(""), &testConfig{})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionApply, AutoUpdate: true})
	update, err := upr.Update(ctx)
	assert.NoError(t, err)
	assert.Nil(t, update.Asset)
}

func testUpdaterError(t *testing.T, errorType ErrorType) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, _ := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionApply, AutoUpdate: true})
	testErr := fmt.Errorf("Test error")
	switch errorType {
	case PromptError:
		ctx.promptErr = testErr
	case VerifyError:
		ctx.verifyErr = testErr
	}

	_, err := upr.Update(ctx)
	assert.EqualError(t, err, fmt.Sprintf("Update Error (%s): Test error", errorType.String()))

	require.NotNil(t, ctx.errReported)
	assert.Equal(t, ctx.errReported.(Error).errorType, errorType)
}

func TestUpdaterErrors(t *testing.T) {
	testUpdaterError(t, PromptError)
	testUpdaterError(t, VerifyError)
}

func TestUpdaterConfigError(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, _ := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{err: fmt.Errorf("Test config error")})
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionApply, AutoUpdate: true})

	_, err := upr.Update(ctx)
	assert.NoError(t, err)

	require.NotNil(t, ctx.errReported)
	assert.Equal(t, ConfigError, ctx.errReported.(Error).errorType)
}

func TestUpdaterAuto(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, _ := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{auto: true, autoSet: true})
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionApply, AutoUpdate: true})

	_, err := upr.Update(ctx)
	assert.NoError(t, err)
	assert.Equal(t, UpdateActionAuto, ctx.actionReported)
}

func TestUpdaterDownloadNil(t *testing.T) {
	upr, err := newTestUpdater(t)
	require.NoError(t, err)
	tmpDir, err := util.MakeTempDir("TestUpdaterDownloadNil", 0700)
	defer util.RemoveFileAtPath(tmpDir)
	require.NoError(t, err)
	err = upr.downloadAsset(nil, tmpDir, UpdateOptions{})
	assert.EqualError(t, err, "No asset to download")
}

func TestUpdaterApplyError(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, _ := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{auto: true, autoSet: true})
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionApply, AutoUpdate: true})

	ctx.beforeApplyErr = fmt.Errorf("Test before error")
	_, err := upr.Update(ctx)
	assert.EqualError(t, err, "Update Error (apply): Test before error")
	ctx.beforeApplyErr = nil

	ctx.afterApplyErr = fmt.Errorf("Test after error")
	_, err = upr.Update(ctx)
	assert.EqualError(t, err, "Update Error (apply): Test after error")
}

func TestUpdaterNotNeeded(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, newTestUpdate(testServer.URL, false), &testConfig{})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionSnooze, AutoUpdate: true})
	update, err := upr.Update(ctx)
	assert.NoError(t, err)
	assert.Nil(t, update)

	assert.False(t, ctx.successReported)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())
}

func TestUpdaterCheckAndUpdate(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping on windows")
	}
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	testUpdate := newTestUpdate(testServer.URL, false)
	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate, &testConfig{})
	assert.NoError(t, err)
	defer func() {
		err = upr.CleanupPreviousUpdates()
		assert.NoError(t, err)
	}()
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionSnooze, AutoUpdate: true})

	// 1.No update from the server
	// Need update = false
	// FindDownloadedAsset = false
	// return updateAvailable = false, updateWasDownloaded = false
	t.Logf("No update from the server")
	updateAvailable, updateWasDownloaded, err := upr.CheckAndDownload(ctx)
	assert.NoError(t, err)
	assert.False(t, updateAvailable)
	assert.False(t, updateWasDownloaded)
	assert.False(t, ctx.successReported)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())

	// 2. Download asset from URL
	// Need update = true
	t.Logf("Download asset from URL")
	testUpdate.NeedUpdate = true
	updateAvailable, updateWasDownloaded, err = upr.CheckAndDownload(ctx)
	assert.NoError(t, err)
	assert.True(t, updateAvailable)
	assert.True(t, updateWasDownloaded)
	assert.False(t, ctx.successReported)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())

	// 3.Find existing downloaded asset
	// Need update = true
	// FindDownloadedAsset = true
	// return updateAvailable = true, updateWasDownloaded = true
	t.Logf("Find existing downloaded assert")
	tmpDir := makeKeybaseUpdateTempDir(t, upr, testUpdate.Asset)
	updateAvailable, updateWasDownloaded, err = upr.CheckAndDownload(ctx)
	assert.NoError(t, err)
	assert.True(t, updateAvailable)
	assert.False(t, updateWasDownloaded)
	assert.False(t, ctx.successReported)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())

	// Run it again to ensure we don't accidentally download again
	t.Logf("Find existing downloaded assert (again)")
	updateAvailable, updateWasDownloaded, err = upr.CheckAndDownload(ctx)
	assert.NoError(t, err)
	assert.True(t, updateAvailable)
	assert.False(t, updateWasDownloaded)
	assert.False(t, ctx.successReported)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())

	util.RemoveFileAtPath(tmpDir)

	// 4.Verify fails b.c. bit flip
	// Need update = true
	// FindDownloadedAsset = true
	// return updateAvailable = false, updateWasDownloaded = false
	t.Logf("bit flip failure verify sig")
	tmpDir = makeKeybaseUpdateTempDir(t, upr, testUpdate.Asset)
	testUpdate.Asset.Signature = invalidSignature

	updateAvailable, updateWasDownloaded, err = upr.CheckAndDownload(ctx)
	assert.EqualError(t, err, "Update Error (verify): error verifying signature: failed to read header bytes")
	assert.False(t, updateAvailable)
	assert.False(t, updateWasDownloaded)
	assert.False(t, ctx.successReported)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())

	util.RemoveFileAtPath(tmpDir)
	testUpdate.Asset.Signature = validSignature

	// 5.Digest fails b.c. bit flip
	// Need update = true
	// FindDownloadedAsset = true
	// return updateAvailable = false, updateWasDownloaded = false
	t.Logf("bit flip failure verify digest")
	tmpDir = makeKeybaseUpdateTempDir(t, upr, testUpdate.Asset)
	testUpdate.Asset.Digest = invalidDigest

	updateAvailable, updateWasDownloaded, err = upr.CheckAndDownload(ctx)
	assert.EqualError(t, err, fmt.Sprintf("Update Error (verify): Invalid digest: 54970995e4d02da631e0634162ef66e2663e0eee7d018e816ac48ed6f7811c84 != 74970995e4d02da631e0634162ef66e2663e0eee7d018e816ac48ed6f7811c84 (%s)", filepath.Join(tmpDir, testUpdate.Asset.Name)))
	assert.False(t, updateAvailable)
	assert.False(t, updateWasDownloaded)
	assert.False(t, ctx.successReported)
	assert.Equal(t, "deadbeef", upr.config.GetInstallID())

	util.RemoveFileAtPath(tmpDir)
	testUpdate.Asset.Digest = validDigest
}

func TestApplyDownloaded(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping on windows")
	}
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	testUpdate := newTestUpdate(testServer.URL, false)
	testAsset := *testUpdate.Asset
	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate, &testConfig{})
	assert.NoError(t, err)
	defer func() {
		err = upr.CleanupPreviousUpdates()
		assert.NoError(t, err)
	}()
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionSnooze, AutoUpdate: true})
	resetCtxErr := func() {
		ctx.promptErr = nil
		ctx.verifyErr = nil
		ctx.beforeApplyErr = nil
		ctx.afterApplyErr = nil
		ctx.errReported = nil
	}

	// 1. NeedUpdate = false -> return nil
	applied, err := upr.ApplyDownloaded(ctx)
	assert.EqualError(t, err, "No previously downloaded update to apply since client is update to date")
	assert.False(t, applied)
	assert.NotNil(t, ctx.errReported)
	assert.Nil(t, ctx.updateReported)
	assert.False(t, ctx.successReported)

	resetCtxErr()

	// 2. Update missing asset
	testUpdate.NeedUpdate = true
	testUpdate.Asset = nil

	applied, err = upr.ApplyDownloaded(ctx)
	assert.EqualError(t, err, "Update contained no asset to apply. Update version: 1.0.1")
	assert.False(t, applied)
	assert.NotNil(t, ctx.errReported)
	assert.Nil(t, ctx.updateReported)
	assert.False(t, ctx.successReported)

	resetCtxErr()
	testUpdate.Asset = &testAsset
	tempURL := testUpdate.Asset.URL
	testUpdate.Asset.URL = ""

	applied, err = upr.ApplyDownloaded(ctx)
	assert.EqualError(t, err, "Update contained no asset to apply. Update version: 1.0.1")
	assert.False(t, applied)
	assert.NotNil(t, ctx.errReported)
	assert.Nil(t, ctx.updateReported)
	assert.False(t, ctx.successReported)

	resetCtxErr()
	testUpdate.Asset.URL = tempURL

	// 3. FindDownloadedAsset = false -> return nil
	applied, err = upr.ApplyDownloaded(ctx)
	assert.EqualError(t, err, "No downloaded asset found for version: 1.0.1")
	assert.False(t, applied)
	assert.NotNil(t, ctx.errReported)
	assert.Nil(t, ctx.updateReported)
	assert.False(t, ctx.successReported)

	resetCtxErr()

	// 4. FindDownloadedAsset = true -> digest fails
	tmpDir := makeKeybaseUpdateTempDir(t, upr, testUpdate.Asset)
	testUpdate.Asset.Digest = invalidDigest

	applied, err = upr.ApplyDownloaded(ctx)
	assert.EqualError(t, err, fmt.Sprintf("Update Error (verify): Invalid digest: 54970995e4d02da631e0634162ef66e2663e0eee7d018e816ac48ed6f7811c84 != 74970995e4d02da631e0634162ef66e2663e0eee7d018e816ac48ed6f7811c84 (%s)", filepath.Join(tmpDir, testUpdate.Asset.Name)))
	assert.False(t, applied)
	assert.NotNil(t, ctx.errReported)
	assert.Nil(t, ctx.updateReported)
	assert.False(t, ctx.successReported)

	resetCtxErr()
	testUpdate.Asset.Digest = validDigest
	util.RemoveFileAtPath(tmpDir)

	// 5. FindDownloadedAsset = true -> verify fails
	tmpDir = makeKeybaseUpdateTempDir(t, upr, testUpdate.Asset)
	testUpdate.Asset.Signature = invalidSignature

	applied, err = upr.ApplyDownloaded(ctx)
	assert.EqualError(t, err, "Update Error (verify): error verifying signature: failed to read header bytes")
	assert.False(t, applied)
	assert.NotNil(t, ctx.errReported)
	assert.Nil(t, ctx.updateReported)
	assert.False(t, ctx.successReported)

	resetCtxErr()
	testUpdate.Asset.Signature = validSignature
	util.RemoveFileAtPath(tmpDir)

	// 6. FindDownloadedAsset = true -> no error success
	tmpDir = makeKeybaseUpdateTempDir(t, upr, testUpdate.Asset)

	applied, err = upr.ApplyDownloaded(ctx)
	assert.NoError(t, err)
	assert.True(t, applied)
	assert.Nil(t, ctx.errReported)
	assert.NotNil(t, ctx.updateReported)
	assert.True(t, ctx.successReported)

	resetCtxErr()
	util.RemoveFileAtPath(tmpDir)
}

func TestFindDownloadedAsset(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping on windows")
	}
	upr, err := newTestUpdater(t)
	assert.NoError(t, err)
	defer func() {
		err = upr.CleanupPreviousUpdates()
		assert.NoError(t, err)
	}()

	// 1. empty asset
	matchingAssetPath, err := upr.FindDownloadedAsset("")
	assert.EqualError(t, err, "No asset name provided")
	assert.Equal(t, "", matchingAssetPath)

	// 2. assset given -> did not create KeybaseUpdate.
	matchingAssetPath, err = upr.FindDownloadedAsset("temp")
	assert.NoError(t, err)
	assert.Equal(t, "", matchingAssetPath)

	// 3. asset given -> created KeybaseUpdate. -> directory empty
	tmpDir, err := util.MakeTempDir("KeybaseUpdater.", 0700)
	assert.NoError(t, err)
	require.NoError(t, err)

	matchingAssetPath, err = upr.FindDownloadedAsset("temp")
	assert.NoError(t, err)
	assert.Equal(t, "", matchingAssetPath)

	util.RemoveFileAtPath(tmpDir)

	// 4. asset given -> created KeybaseUpdate. -> file exists but no match
	tmpDir, err = util.MakeTempDir("KeybaseUpdater.", 0700)
	assert.NoError(t, err)
	tmpFile := filepath.Join(tmpDir, "nottemp")
	err = os.WriteFile(tmpFile, []byte("Contents of temp file"), 0700)
	require.NoError(t, err)

	matchingAssetPath, err = upr.FindDownloadedAsset("temp")
	assert.NoError(t, err)
	assert.Equal(t, "", matchingAssetPath)

	util.RemoveFileAtPath(tmpDir)

	// 5. asset given -> created KeybaseUpdate. -> file exixst and matches
	tmpDir, err = util.MakeTempDir("KeybaseUpdater.", 0700)
	tmpFile = filepath.Join(tmpDir, "temp")
	err = os.WriteFile(tmpFile, []byte("Contents of temp file"), 0700)
	require.NoError(t, err)

	matchingAssetPath, err = upr.FindDownloadedAsset("temp")
	assert.NoError(t, err)
	assert.Equal(t, tmpFile, matchingAssetPath)

	util.RemoveFileAtPath(tmpDir)

}

func TestUpdaterGuiBusy(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()

	upr, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{auto: true, autoSet: true})
	assert.NoError(t, err)
	ctx := newTestContext(newDefaultTestUpdateOptions(), upr.config, &UpdatePromptResponse{Action: UpdateActionApply, AutoUpdate: true})
	// Expect no error when the app state config is not found, allowing auto update to continue
	_, err = upr.Update(ctx)
	assert.NoError(t, err)

	// Now put the config file there and make sure the right error is returned
	now := time.Now().Unix() * 1000
	err = os.WriteFile(testAppStatePath, []byte(fmt.Sprintf(`{"isUserActive":true, "changedAtMs":%d}`, now)), 0644)
	assert.NoError(t, err)
	defer util.RemoveFileAtPath(testAppStatePath)
	_, err = upr.Update(ctx)
	assert.EqualError(t, err, "Update Error (guiBusy): User active, retrying later")

	// If the user was recently active, they are still considered busy.
	err = os.WriteFile(testAppStatePath, []byte(fmt.Sprintf(`{"isUserActive":false, "changedAtMs":%d}`, now)), 0644)
	assert.NoError(t, err)
	_, err = upr.Update(ctx)
	assert.EqualError(t, err, "Update Error (guiBusy): User active, retrying later")

	// Make sure check command doesn't skip update on active UI
	ctx.isCheckCommand = true
	_, err = upr.Update(ctx)
	assert.NoError(t, err)

	// If the user wasn't recently active, they are not considered busy
	ctx.isCheckCommand = false
	later := time.Now().Add(-5*time.Minute).Unix() * 1000
	err = os.WriteFile(testAppStatePath, []byte(fmt.Sprintf(`{"isUserActive":false, "changedAtMs":%d}`, later)), 0644)
	assert.NoError(t, err)
	_, err = upr.Update(ctx)
	assert.NoError(t, err)
}
