// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/kbfs/libpages/config"
	"github.com/stretchr/testify/require"
)

type fakePrompterForTest struct {
	nextResponse string
	lastPrompt   string
}

func (p *fakePrompterForTest) Prompt(prompt string) (string, error) {
	p.lastPrompt = prompt
	return p.nextResponse, nil
}

func (p *fakePrompterForTest) PromptPassword(prompt string) (string, error) {
	p.lastPrompt = prompt
	return p.nextResponse, nil
}

func TestEditor(t *testing.T) {
	configDir, err := ioutil.TempDir(".", "kbpagesconfig-editor-test-")
	require.NoError(t, err)
	defer os.RemoveAll(configDir)
	kbpConfigPath := filepath.Join(configDir, config.DefaultConfigFilename)

	prompter := &fakePrompterForTest{}

	editor, err := newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	// The config file shouldn't exist yet.
	_, err = os.Stat(kbpConfigPath)
	require.Error(t, err)
	require.True(t, os.IsNotExist(err))
	// Call confirmAndWrite which should create the config file.
	prompter.nextResponse = "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	_, err = os.Stat(kbpConfigPath)
	require.NoError(t, err)

	// add user
	editor, err = newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	// It's an empty config now so authentication should fail.
	ok := editor.kbpConfig.Authenticate("alice", "12345")
	require.False(t, ok)
	// Try adding a user "alice" with password "12345" and "bob" with password
	// "54321".
	prompter.nextResponse = "12345"
	err = editor.addUser("alice")
	require.NoError(t, err)
	prompter.nextResponse = "54321"
	err = editor.addUser("bob")
	require.NoError(t, err)
	prompter.nextResponse = "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	// Re-read the config file and make sure the user is added properly.
	editor, err = newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	ok = editor.kbpConfig.Authenticate("alice", "12345")
	require.True(t, ok)
	ok = editor.kbpConfig.Authenticate("bob", "54321")
	require.True(t, ok)

	// remove "bob"
	editor, err = newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	editor.removeUser("bob")
	require.NoError(t, err)
	prompter.nextResponse = "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	// Re-read the config file and make sure "bob" is gone and "alice" is still
	// there.
	editor, err = newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	ok = editor.kbpConfig.Authenticate("bob", "54321")
	require.False(t, ok)
	ok = editor.kbpConfig.Authenticate("alice", "12345")
	require.True(t, ok)

	// set anonymous permissions
	editor, err = newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	// We don't have any permission set, so we should get the default read,list
	// for root.
	read, list, _, _, _, err := editor.kbpConfig.GetPermissions("/", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	err = editor.setAnonymousPermission("read", "/")
	require.NoError(t, err)
	prompter.nextResponse = "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	// Re-read the config file and make sure the user is gone.
	editor, err = newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err = editor.kbpConfig.GetPermissions("/", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)

	alice := "alice"
	// grant alice additional permissions
	editor, err = newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err = editor.kbpConfig.GetPermissions(
		"/", &alice)
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)
	err = editor.setAdditionalPermission("alice", "list", "/")
	require.NoError(t, err)
	prompter.nextResponse = "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	// Re-read the config file and make sure the user is gone.
	editor, err = newKBPConfigEditorWithPrompter(configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err = editor.kbpConfig.GetPermissions(
		"/", &alice)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
}
