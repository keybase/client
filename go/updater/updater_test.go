// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

func NewTestUpdater(t *testing.T, options keybase1.UpdateOptions) *Updater {
	return NewUpdater(options, testUpdateSource{}, testConfig{}, logger.NewTestLogger(t))
}

type testUpdateUI struct{}

func (u testUpdateUI) UpdatePrompt(_ context.Context, _ keybase1.UpdatePromptArg) (keybase1.UpdatePromptRes, error) {
	return keybase1.UpdatePromptRes{Action: keybase1.UpdateAction_UPDATE}, nil
}

func (u testUpdateUI) UpdateQuit(_ context.Context) (keybase1.UpdateQuitRes, error) {
	return keybase1.UpdateQuitRes{Quit: false}, nil
}

func (u testUpdateUI) GetUpdateUI() (libkb.UpdateUI, error) {
	return u, nil
}

func (u testUpdateUI) UpdateAppInUse(context.Context, keybase1.UpdateAppInUseArg) (keybase1.UpdateAppInUseRes, error) {
	return keybase1.UpdateAppInUseRes{Action: keybase1.UpdateAppInUseAction_CANCEL}, nil
}

type testUpdateSource struct{}

func (u testUpdateSource) Description() string {
	return "Test"
}

func (u testUpdateSource) FindUpdate(config keybase1.UpdateOptions) (release *keybase1.Update, err error) {
	version := "1.0.1"
	update := keybase1.Update{
		Version:     version,
		Name:        "Test",
		Description: "Bug fixes",
	}

	path, assetName, err := createTestUpdateFile(version)
	if err != nil {
		return nil, err
	}

	if path != "" {
		digest, err := libkb.DigestForFileAtPath(path)
		if err != nil {
			return nil, err
		}

		update.Asset = &keybase1.Asset{
			Name:   assetName,
			Url:    fmt.Sprintf("file://%s", path),
			Digest: digest,
		}
	}

	return &update, nil
}

type testConfig struct {
	lastChecked keybase1.Time
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

func (c testConfig) SetUpdatePreferenceAuto(b bool) error {
	return nil
}

func (c testConfig) SetUpdatePreferenceSkip(v string) error {
	return nil
}

func (c testConfig) SetUpdatePreferenceSnoozeUntil(t keybase1.Time) error {
	return nil
}

func (c testConfig) SetUpdateLastChecked(t keybase1.Time) error {
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
	u := NewTestUpdater(t, NewDefaultTestUpdateConfig())
	update, err := u.Update(testUpdateUI{}, false, false)
	if err != nil {
		t.Error(err)
	}

	if update == nil {
		t.Errorf("Should have an update")
	}
}

func TestUpdateCheckErrorIfLowerVersion(t *testing.T) {
	u := NewTestUpdater(t, NewDefaultTestUpdateConfig())
	u.options.Version = "100000000.0.0"

	update, err := u.checkForUpdate(true, false, false)
	if err != nil {
		t.Fatal(err)
	}
	if update != nil {
		t.Fatal("Shouldn't have update since our version is newer")
	}
}
