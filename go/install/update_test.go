// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"archive/zip"
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

func NewTestUpdater(t *testing.T, config keybase1.UpdateConfig) Updater {
	context := libkb.NewGlobalContext()
	context.Init()
	context.Log = logger.NewTestLogger(t)
	return NewUpdater(context, config, testUpdateSource{})
}

type testUpdateSource struct{}

type nullUpdateUI struct{}

func (u nullUpdateUI) UpdatePrompt(_ context.Context, _ keybase1.UpdatePromptArg) (keybase1.UpdatePromptRes, error) {
	return keybase1.UpdatePromptRes{Action: keybase1.UpdateAction_UPDATE}, nil
}

func (u testUpdateSource) FindUpdate(config keybase1.UpdateConfig) (release *keybase1.Update, err error) {
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

func NewDefaultTestUpdateConfig() keybase1.UpdateConfig {
	return keybase1.UpdateConfig{
		Version:         "1.0.0",
		Platform:        runtime.GOOS,
		DestinationPath: filepath.Join(os.TempDir(), "Test"),
		Source:          "test",
	}
}

func TestUpdater(t *testing.T) {
	u := NewTestUpdater(t, NewDefaultTestUpdateConfig())
	update, err := u.Update(nullUpdateUI{})
	if err != nil {
		t.Error(err)
	}

	if update == nil {
		t.Errorf("Should have an update")
	}
}

func TestUpdateCheckErrorIfLowerVersion(t *testing.T) {
	u := NewTestUpdater(t, NewDefaultTestUpdateConfig())
	u.config.Version = "100000000.0.0"

	_, err := u.CheckForUpdate()
	if err == nil {
		t.Fatal("We should've errored since the update version is less then the current version")
	}
}

func createTestUpdateZip() (string, error) {
	path := filepath.Join(os.TempDir(), "Test.zip")
	if _, err := os.Stat("/path/to/whatever"); err == nil {
		return path, nil
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
