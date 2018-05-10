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
	"golang.org/x/crypto/bcrypt"
)

func TestUpgrade(t *testing.T) {
	configDir, err := ioutil.TempDir(".", "kbpagesconfig-editor-test-")
	require.NoError(t, err)
	defer os.RemoveAll(configDir)
	kbpConfigPath := filepath.Join(configDir, config.DefaultConfigFilename)

	t.Logf("creating v1 config at %s", kbpConfigPath)

	v1 := config.DefaultV1()

	bcryptHash, err := bcrypt.GenerateFromPassword([]byte("ecila"), bcrypt.MinCost)
	require.NoError(t, err)
	v1.Users = make(map[string]string)
	v1.Users["alice"] = string(bcryptHash)

	f, err := os.Create(kbpConfigPath)
	require.NoError(t, err)
	err = v1.Encode(f, true)
	require.NoError(t, err)

	t.Logf("testing upgrade")

	nextResponse := make(chan string, 4)
	prompter := &fakePrompterForTest{
		nextResponse: nextResponse,
	}

	nextResponse <- "y"
	nextResponse <- "123"
	nextResponse <- "ecila"
	nextResponse <- "y"

	err = upgradeToV2WithPrompter(configDir, prompter)
	require.NoError(t, err)
}
