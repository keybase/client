// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateCheckerStart(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer func() {
		// Give time for checker to stop before closing
		time.Sleep(20 * time.Millisecond)
		testServer.Close()
	}()
	updater, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	assert.NoError(t, err)

	checker := NewUpdateChecker(updater, testUpdateCheckUI{}, 5*time.Millisecond, testLog)
	defer checker.Stop()
	started := checker.Start()
	require.True(t, started)
	started = checker.Start()
	require.False(t, started)
	// Wait for the count to increase (to prevent flakeyness on slow CIs)
	for i := 0; checker.Count() == 0 && i < 10; i++ {
		time.Sleep(5 * time.Millisecond)
	}
	assert.True(t, checker.Count() >= 1)

	checker.Stop()
}

type testUpdateCheckUI struct {
	verifyError error
}

func (u testUpdateCheckUI) BeforeUpdatePrompt(_ Update, _ UpdateOptions) error {
	return nil
}

func (u testUpdateCheckUI) UpdatePrompt(_ Update, _ UpdateOptions, _ UpdatePromptOptions) (*UpdatePromptResponse, error) {
	return &UpdatePromptResponse{Action: UpdateActionApply}, nil
}

func (u testUpdateCheckUI) BeforeApply(update Update) error {
	return nil
}

func (u testUpdateCheckUI) Apply(update Update, options UpdateOptions, tmpDir string) error {
	return nil
}

func (u testUpdateCheckUI) AfterApply(update Update) error {
	return nil
}

func (u testUpdateCheckUI) GetUpdateUI() UpdateUI {
	return u
}

func (u testUpdateCheckUI) Verify(update Update) error {
	return u.verifyError
}

func (u testUpdateCheckUI) AfterUpdateCheck(update *Update) {}

func (u testUpdateCheckUI) UpdateOptions() UpdateOptions {
	return newDefaultTestUpdateOptions()
}

func (u testUpdateCheckUI) ReportAction(_ UpdateAction, _ *Update, _ UpdateOptions) {}

func (u testUpdateCheckUI) ReportError(_ error, _ *Update, _ UpdateOptions) {}

func (u testUpdateCheckUI) ReportSuccess(_ *Update, _ UpdateOptions) {}

func TestUpdateCheckerError(t *testing.T) {
	testServer := testServerForUpdateFile(t, testZipPath)
	defer testServer.Close()
	updater, err := newTestUpdaterWithServer(t, testServer, testUpdate(testServer.URL), &testConfig{})
	assert.NoError(t, err)

	checker := NewUpdateChecker(updater, testUpdateCheckUI{verifyError: fmt.Errorf("Test verify error")}, time.Minute, testLog)
	err = checker.check()
	require.Error(t, err)
}
