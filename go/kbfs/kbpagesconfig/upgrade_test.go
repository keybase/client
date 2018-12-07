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
	"golang.org/x/crypto/bcrypt"
)

func TestUpgrade(t *testing.T) {
	configDir, err := ioutil.TempDir(".", "kbpagesconfig-editor-test-")
	require.NoError(t, err)
	defer os.RemoveAll(configDir)
	kbpConfigPath := filepath.Join(configDir, config.DefaultConfigFilename)

	t.Logf("creating config with bcrypt pass at %s", kbpConfigPath)

	v1 := config.DefaultV1()

	bcryptHash, err := bcrypt.GenerateFromPassword([]byte("ecila"), bcrypt.MinCost)
	require.NoError(t, err)
	v1.Users = make(map[string]string)
	v1.Users["alice"] = string(bcryptHash)

	f1, err := os.Create(kbpConfigPath)
	require.NoError(t, err)
	defer f1.Close()
	err = v1.Encode(f1, true)
	require.NoError(t, err)

	t.Logf("testing upgrade")

	nextResponse := make(chan string, 5)
	prompter := &fakePrompterForTest{
		nextResponse: nextResponse,
	}

	nextResponse <- "y"     // "You are about to migrate ..."
	nextResponse <- "123"   // answer with a wrong password
	nextResponse <- "n"     // don't use a random generated one
	nextResponse <- "ecila" // give correct password
	nextResponse <- "y"     // confirm write

	err = upgradeToSHA256WithPrompter(configDir, prompter)
	require.NoError(t, err)

	t.Logf("testing new config is upgraded and still works")
	f2, err := os.Open(kbpConfigPath)
	require.NoError(t, err)
	defer f2.Close()

	cfg, err := config.ParseConfig(f2)
	require.NoError(t, err)
	require.Equal(t, config.Version1, cfg.Version())
	v1 = cfg.(*config.V1)

	needsUpgrade, err := v1.HasBcryptPasswords()
	require.NoError(t, err)
	require.False(t, needsUpgrade)
	authed := v1.Authenticate(context.Background(), "alice", "ecila")
	require.True(t, authed)
}
