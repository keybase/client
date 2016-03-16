// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"crypto/rand"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

type processUpdate func(update *keybase1.Update, path string)

func NewTestUpdater(t *testing.T, options keybase1.UpdateOptions, p processUpdate) (*Updater, error) {
	updateSource, err := newTestUpdateSource(p)
	if err != nil {
		return nil, err
	}
	config := &testConfig{}
	return NewUpdater(options, updateSource, config, logger.NewTestLogger(t)), nil
}

type testUpdateUI struct{}

func (u testUpdateUI) UpdatePrompt(_ context.Context, _ keybase1.UpdatePromptArg) (keybase1.UpdatePromptRes, error) {
	return keybase1.UpdatePromptRes{Action: keybase1.UpdateAction_UPDATE}, nil
}

func (u testUpdateUI) UpdateQuit(_ context.Context, _ keybase1.UpdateQuitArg) (keybase1.UpdateQuitRes, error) {
	return keybase1.UpdateQuitRes{Quit: false}, nil
}

func (u testUpdateUI) GetUpdateUI() (libkb.UpdateUI, error) {
	return u, nil
}

func (u testUpdateUI) AfterUpdateApply(willRestart bool) error {
	return nil
}

func (u testUpdateUI) UpdateAppInUse(context.Context, keybase1.UpdateAppInUseArg) (keybase1.UpdateAppInUseRes, error) {
	return keybase1.UpdateAppInUseRes{Action: keybase1.UpdateAppInUseAction_CANCEL}, nil
}

func (u testUpdateUI) Verify(r io.Reader, signature string) error {
	digest, err := libkb.Digest(r)
	if err != nil {
		return err
	}
	if signature != digest {
		return fmt.Errorf("Verify failed")
	}
	return nil
}

type testUpdateSource struct {
	processUpdate processUpdate
}

func newTestUpdateSource(p processUpdate) (testUpdateSource, error) {
	return testUpdateSource{processUpdate: p}, nil
}

func (u testUpdateSource) Description() string {
	return "Test"
}

func (u testUpdateSource) FindUpdate(config keybase1.UpdateOptions) (*keybase1.Update, error) {
	version := "1.0.1"
	update := keybase1.Update{
		Version:     version,
		Name:        "Test",
		Description: "Bug fixes",
	}

	path := filepath.Join(os.TempDir(), "Test.zip")
	assetName, err := createTestUpdateFile(path, version)
	if err != nil {
		return nil, err
	}

	if path != "" {
		digest, err := libkb.DigestForFileAtPath(path)
		if err != nil {
			return nil, err
		}

		update.Asset = &keybase1.Asset{
			Name:      assetName,
			Url:       fmt.Sprintf("file://%s", path),
			Digest:    digest,
			Signature: digest, // Use digest as signature in test
		}
	}

	if u.processUpdate != nil {
		u.processUpdate(&update, path)
	}

	return &update, nil
}

type testConfig struct {
	lastChecked  keybase1.Time
	publicKeyHex string
}

func (c testConfig) GetUpdatePreferenceAuto() (bool, bool) {
	return false, false
}

func (c testConfig) GetUpdatePreferenceSnoozeUntil() keybase1.Time {
	return keybase1.Time(0)
}

func (c testConfig) GetUpdateLastChecked() keybase1.Time {
	return c.lastChecked
}

func (c testConfig) GetUpdatePreferenceSkip() string {
	return ""
}

func (c *testConfig) SetUpdatePreferenceAuto(b bool) error {
	return nil
}

func (c *testConfig) SetUpdatePreferenceSkip(v string) error {
	return nil
}

func (c *testConfig) SetUpdatePreferenceSnoozeUntil(t keybase1.Time) error {
	return nil
}

func (c *testConfig) SetUpdateLastChecked(t keybase1.Time) error {
	c.lastChecked = t
	return nil
}

func (c testConfig) GetRunModeAsString() string {
	return "test"
}

func (c testConfig) GetMountDir() string {
	return filepath.Join(os.Getenv("HOME"), "keybase.test")
}

func NewDefaultTestUpdateConfig() keybase1.UpdateOptions {
	return keybase1.UpdateOptions{
		Version:             "1.0.0",
		Platform:            runtime.GOOS,
		DestinationPath:     filepath.Join(os.TempDir(), "Test"),
		Source:              "test",
		DefaultInstructions: "Bug fixes",
	}
}

func TestUpdater(t *testing.T) {
	u, err := NewTestUpdater(t, NewDefaultTestUpdateConfig(), nil)
	if err != nil {
		t.Fatal(err)
	}
	update, err := u.Update(testUpdateUI{}, false, false)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("Update: %#v\n", update)

	if update.Asset == nil {
		t.Errorf("No asset")
	}

	t.Logf("Asset: %#v\n", *update.Asset)

	if update.Asset.Signature == "" {
		t.Errorf("No signature")
	}

	if update == nil {
		t.Errorf("Should have an update")
	}
}

func TestUpdateCheckErrorIfLowerVersion(t *testing.T) {
	u, err := NewTestUpdater(t, NewDefaultTestUpdateConfig(), nil)
	if err != nil {
		t.Fatal(err)
	}
	u.options.Version = "100000000.0.0"

	update, err := u.checkForUpdate(true, false, false)
	if err != nil {
		t.Fatal(err)
	}
	if update != nil {
		t.Fatal("Shouldn't have update since our version is newer")
	}
}

func TestChangeUpdateFailSignature(t *testing.T) {
	changeAsset := func(u *keybase1.Update, path string) {
		// Write new file over existing (fix digest but not signature)
		createTestUpdateFile(path, u.Version)
		digest, _ := libkb.DigestForFileAtPath(path)
		t.Logf("Wrote a new update file: %s (%s)", path, digest)
		u.Asset.Digest = digest
	}
	updater, err := NewTestUpdater(t, NewDefaultTestUpdateConfig(), changeAsset)
	if err != nil {
		t.Fatal(err)
	}
	_, err = updater.Update(testUpdateUI{}, false, false)
	t.Logf("Err: %s\n", err)
	if err == nil {
		t.Fatal("Should have failed")
	}
}

func randString(n int) string {
	const alphanum = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	var bytes = make([]byte, n)
	rand.Read(bytes)
	for i, b := range bytes {
		bytes[i] = alphanum[b%byte(len(alphanum))]
	}
	return string(bytes)
}
