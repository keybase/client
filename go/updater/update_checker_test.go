// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"io"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/updater/protocol"
	"golang.org/x/net/context"
)

// TestUpdateCheckerIsAsync checks to make sure if the updater is blocked in a
// prompt that checks continue. This is safe because the updater is
// singleflighted.
func TestUpdateCheckerIsAsync(t *testing.T) {
	updater, err := NewTestUpdater(t, NewDefaultTestUpdateConfig(), nil)
	if err != nil {
		t.Fatal(err)
	}

	checker := newUpdateChecker(updater, testUpdateCheckUI{promptDelay: 400 * time.Millisecond}, logger.NewTestLogger(t), 50*time.Millisecond, 100*time.Millisecond)
	defer checker.Stop()
	checker.Start()

	time.Sleep(400 * time.Millisecond)

	if checker.Count() <= 2 {
		t.Fatal("Checker should have checked more than once")
	}
}

type testUpdateCheckUI struct {
	promptDelay time.Duration
}

func (u testUpdateCheckUI) UpdatePrompt(_ context.Context, _ keybase1.UpdatePromptArg) (keybase1.UpdatePromptRes, error) {
	time.Sleep(u.promptDelay)
	return keybase1.UpdatePromptRes{Action: keybase1.UpdateAction_UPDATE}, nil
}

func (u testUpdateCheckUI) UpdateQuit(_ context.Context, _ keybase1.UpdateQuitArg) (keybase1.UpdateQuitRes, error) {
	return keybase1.UpdateQuitRes{Quit: false}, nil
}

func (u testUpdateCheckUI) GetUpdateUI() (libkb.UpdateUI, error) {
	return u, nil
}

func (u testUpdateCheckUI) AfterUpdateApply(willRestart bool) error {
	return nil
}

func (u testUpdateCheckUI) Verify(r io.Reader, signature string) error {
	return nil
}

func (u testUpdateCheckUI) UpdateAppInUse(context.Context, keybase1.UpdateAppInUseArg) (keybase1.UpdateAppInUseRes, error) {
	return keybase1.UpdateAppInUseRes{Action: keybase1.UpdateAppInUseAction_CANCEL}, nil
}

func TestUpdateCheckerSince(t *testing.T) {
	updater, err := NewTestUpdater(t, NewDefaultTestUpdateConfig(), nil)
	if err != nil {
		t.Fatal(err)
	}
	checker := newUpdateChecker(updater, testUpdateCheckUI{}, logger.NewTestLogger(t), time.Second, 300*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	checked, err := checker.Check(false, false)
	if !checked {
		t.Fatal("Should have checked (1)")
	}
	checked, err = checker.Check(false, false)
	if checked {
		t.Fatal("Should not have checked (2)")
	}
	time.Sleep(300 * time.Millisecond)
	checked, err = checker.Check(false, false)
	if !checked {
		t.Fatal("Should have checked (3)")
	}
}
