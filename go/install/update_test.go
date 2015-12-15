// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"os"
	"path"
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
	return &keybase1.Update{
		Version:     "1.0.1",
		Name:        "Test",
		Description: "Bug fixes",
		Asset: keybase1.Asset{
			Name: "Test-1.0.1.zip",
			Url:  "https://keybase-app.s3.amazonaws.com/Test-1.0.1.zip",
		}}, nil
}

func NewDefaultTestUpdateConfig() keybase1.UpdateConfig {
	return keybase1.UpdateConfig{
		Version:         "1.0.0",
		OsName:          runtime.GOOS,
		DestinationPath: path.Join(os.TempDir(), "Test"),
		Source:          "local",
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

func TestUpdateDownloadAsset(t *testing.T) {
	u := NewTestUpdater(t, NewDefaultTestUpdateConfig())

	asset := keybase1.Asset{Name: "Test-1.0.1.zip", Url: "https://keybase-app.s3.amazonaws.com/Test-1.0.1.zip"}

	// Clear any cached file
	assetPath := u.pathForFilename(asset.Name)
	os.Remove(assetPath)

	dlpath, cached, err := u.downloadAsset(asset)
	if err != nil {
		t.Error(err)
	}
	defer os.Remove(dlpath)
	if cached {
		t.Errorf("Shouldn't have been cached")
	}
	if dlpath == "" {
		t.Errorf("No download path")
	}

	// Download again, check it was cached
	dlpath, cached, err = u.downloadAsset(asset)
	if err != nil {
		t.Error(err)
	}
	if !cached {
		t.Errorf("Not cached")
	}
	if dlpath == "" {
		t.Errorf("No download path")
	}
}
