// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbfs/libpages/config"
	"github.com/stretchr/testify/require"
)

func TestEditor(t *testing.T) {
	configDir, err := ioutil.TempDir(".", "kbpagesconfig-editor-test-")
	require.NoError(t, err)
	defer os.RemoveAll(configDir)
	kbpConfigPath := filepath.Join(configDir, config.DefaultConfigFilename)

	nextResponse := make(chan string, 4)
	prompter := &fakePrompterForTest{
		nextResponse: nextResponse,
	}

	editor, err := newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	// The config file shouldn't exist yet.
	_, err = os.Stat(kbpConfigPath)
	require.Error(t, err)
	require.True(t, os.IsNotExist(err))
	// Call confirmAndWrite which should create the config file.
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	_, err = os.Stat(kbpConfigPath)
	require.NoError(t, err)

	ctx := context.Background()

	// add user
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	// It's an empty config now so authentication should fail.
	ok := editor.kbpConfig.Authenticate(ctx, "alice", "12345")
	require.False(t, ok)
	// Try adding a user "alice" with password "12345" and "bob" with password
	// "54321".
	nextResponse <- "n"
	nextResponse <- "12345"
	err = editor.setUser("alice", true)
	require.NoError(t, err)
	nextResponse <- "n"
	nextResponse <- "54321"
	err = editor.setUser("bob", true)
	require.NoError(t, err)
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	// Re-read the config file and make sure the user is added properly.
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	ok = editor.kbpConfig.Authenticate(ctx, "alice", "12345")
	require.True(t, ok)
	ok = editor.kbpConfig.Authenticate(ctx, "bob", "54321")
	require.True(t, ok)

	// remove "bob"
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	editor.removeUser("bob")
	require.NoError(t, err)
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	// Re-read the config file and make sure "bob" is gone and "alice" is still
	// there.
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	ok = editor.kbpConfig.Authenticate(ctx, "bob", "54321")
	require.False(t, ok)
	ok = editor.kbpConfig.Authenticate(ctx, "alice", "12345")
	require.True(t, ok)

	// set anonymous permissions
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	// We don't have any permission set, so we should get the default read,list
	// for root.
	read, list, _, _, _, err := editor.kbpConfig.GetPermissions("/", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	err = editor.setAnonymousPermission("read", "/")
	require.NoError(t, err)
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	// Re-read the config file and make sure the user is gone.
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err = editor.kbpConfig.GetPermissions("/", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)

	alice := "alice"
	// grant alice additional permissions
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err = editor.kbpConfig.GetPermissions(
		"/", &alice)
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)
	err = editor.setAdditionalPermission("alice", "list", "/")
	require.NoError(t, err)
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	// Re-read the config file and make sure the user is gone.
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err = editor.kbpConfig.GetPermissions(
		"/", &alice)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
}
