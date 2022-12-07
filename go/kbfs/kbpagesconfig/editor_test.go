// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbfs/libpages/config"
	"github.com/stretchr/testify/require"
)

func TestEditorACLs(t *testing.T) {
	configDir, err := os.MkdirTemp(".", "kbpagesconfig-editor-test-")
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

	t.Logf("it's an empty config now so authentication should fail")
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	ok := editor.kbpConfig.Authenticate(ctx, "alice", "12345")
	require.False(t, ok)
	t.Logf(`try adding a user "alice" with password "12345" and "bob" with password "54321"`)
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
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	ok = editor.kbpConfig.Authenticate(ctx, "alice", "12345")
	require.True(t, ok)
	ok = editor.kbpConfig.Authenticate(ctx, "bob", "54321")
	require.True(t, ok)

	t.Logf("remove bob")
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

	t.Logf("default permission for root is read")
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err := editor.kbpConfig.GetPermissions("/", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)

	alice := "alice"
	t.Logf("grant alice additional permissions")
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
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err = editor.kbpConfig.GetPermissions(
		"/", &alice)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)

	t.Logf("grant anonymous list permissions as well")
	err = editor.setAnonymousPermission("read,list", "/")
	require.NoError(t, err)
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)
	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	read, list, _, _, _, err = editor.kbpConfig.GetPermissions("/", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)

}

func TestEditorSimple(t *testing.T) {
	configDir, err := os.MkdirTemp(".", "kbpagesconfig-editor-test-")
	require.NoError(t, err)
	defer os.RemoveAll(configDir)

	nextResponse := make(chan string, 4)
	prompter := &fakePrompterForTest{
		nextResponse: nextResponse,
	}

	editor, err := newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	err = editor.setAccessControlAllowOrigin("/", "")
	require.NoError(t, err)
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)

	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	err = editor.setAccessControlAllowOrigin("/", "*")
	require.NoError(t, err)
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)

	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	err = editor.setAccessControlAllowOrigin("/", "https://keybase.io")
	require.Error(t, err)

	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	err = editor.set403("/", "/403.html")
	require.NoError(t, err)
	nextResponse <- "y"
	err = editor.confirmAndWrite()
	require.NoError(t, err)

	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	err = editor.set404("/", "/404")
	require.NoError(t, err)

	editor, err = newKBPConfigEditorWithPrompter(
		configDir, prompter)
	require.NoError(t, err)
	err = editor.set404("/", "../404.html")
	require.Error(t, err)
}
