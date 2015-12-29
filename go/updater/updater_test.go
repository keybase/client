// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"archive/zip"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

func NewTestUpdater(t *testing.T, options keybase1.UpdateOptions) Updater {
	return NewUpdater(options, testUpdateSource{}, testConfig{}, logger.NewTestLogger(t))
}

type testUpdateSource struct{}

type nullUpdateUI struct{}

func (u nullUpdateUI) UpdatePrompt(_ context.Context, _ keybase1.UpdatePromptArg) (keybase1.UpdatePromptRes, error) {
	return keybase1.UpdatePromptRes{Action: keybase1.UpdateAction_UPDATE}, nil
}

func (u nullUpdateUI) UpdateQuit(_ context.Context) (keybase1.UpdateQuitRes, error) {
	return keybase1.UpdateQuitRes{Quit: false}, nil
}

func (u testUpdateSource) Description() string {
	return "Test"
}

func (u testUpdateSource) FindUpdate(config keybase1.UpdateOptions) (release *keybase1.Update, err error) {
	path, err := createTestUpdateZip()
	if err != nil {
		return nil, err
	}

	return &keybase1.Update{
		Version:     "1.0.1",
		Name:        "Test",
		Description: "Bug fixes",
		Asset: keybase1.Asset{
			Name: "Test-1.0.1.zip",
			Url:  fmt.Sprintf("file://%s", path),
		}}, nil
}

type testConfig struct{}

func (c testConfig) GetUpdatePreferenceAuto() bool {
	return false
}

func (c testConfig) GetUpdatePreferenceSnoozeUntil() keybase1.Time {
	return keybase1.Time(0)
}

func (c testConfig) GetUpdatePreferenceSkip() string {
	return ""
}

func (c testConfig) SetUpdatePreferenceAuto(b bool) error {
	panic("Unsupported")
}

func (c testConfig) SetUpdatePreferenceSkip(v string) error {
	panic("Unsupported")
}

func (c testConfig) SetUpdatePreferenceSnoozeUntil(t keybase1.Time) error {
	panic("Unsupported")
}

func NewDefaultTestUpdateConfig() keybase1.UpdateOptions {
	return keybase1.UpdateOptions{
		Version:         "1.0.0",
		Platform:        runtime.GOOS,
		DestinationPath: filepath.Join(os.TempDir(), "Test"),
		Source:          "test",
	}
}

func TestUpdater(t *testing.T) {
	u := NewTestUpdater(t, NewDefaultTestUpdateConfig())
	update, err := u.Update(nullUpdateUI{}, false, false)
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

	_, err := u.CheckForUpdate(true, false, false)
	if err == nil {
		t.Fatal("We should've errored since the update version is less then the current version")
	}
}

func createTestUpdateZip() (string, error) {
	path := filepath.Join(os.TempDir(), "Test.zip")
	// Clear if exists
	if _, err := os.Stat(path); err == nil {
		err := os.Remove(path)
		if err != nil {
			return "", err
		}
	}
	zipFile, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer zipFile.Close()

	w := zip.NewWriter(zipFile)
	f, err := w.Create("Test/Test.txt")
	if err != nil {
		return "", err
	}
	_, err = f.Write([]byte("This is a test file for updates"))
	if err != nil {
	}
	err = w.Close()
	if err != nil {
		return "", err
	}
	return path, nil
}
