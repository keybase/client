// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/keybase/client/go/kbfs/libpages/config"
	"github.com/keybase/client/go/minterm"
	"github.com/urfave/cli"
)

func migrateUserToSHA256Hash(p prompter, username string, oldConfig config.Config) (sha256Hash string, err error) {
	for { // loop until user ctrl-C the command
		input, err := p.PromptPassword(fmt.Sprintf(
			"enter the password for %s: ", username))
		if err != nil {
			fmt.Fprintf(os.Stderr, "getting password error: %v\n", err)
			continue
		}
		password := strings.TrimSpace(input)
		if len(password) == 0 {
			fmt.Fprintf(os.Stderr, "empty password\n")
			continue
		}
		if oldConfig.Authenticate(context.Background(), username, password) {
			return config.GenerateSHA256PasswordHash(password)
		}
		fmt.Fprintf(os.Stderr, "password for %s doesn't match what's in the old config file\n", username)
		confirmed, err := promptConfirm(p, fmt.Sprintf(
			"The password you entered for %s doesn't match what's "+
				"currently in the old config file. Still use it?\n",
			username), false)
		if err != nil {
			fmt.Fprintf(os.Stderr, "getting confirmation error: %v\n", err)
			continue
		}
		if confirmed {
			return config.GenerateSHA256PasswordHash(password)
		}
	}
}

func upgradeToSHA256WithPrompter(kbpConfigDir string, prompter prompter) (err error) {
	kbpConfigPath, err := kbpConfigPath(kbpConfigDir)
	if err != nil {
		return err
	}
	f, err := os.Open(kbpConfigPath)
	switch {
	case err == nil:
	case os.IsNotExist(err):
		return fmt.Errorf("no kbpages config file exists in %s", kbpConfigDir)
	default:
		return fmt.Errorf("open file %s error: %v", kbpConfigPath, err)
	}

	cfg, originalConfigStr, err := readConfigAndClose(f)
	if err != nil {
		return fmt.Errorf(
			"reading config file %s error: %v", kbpConfigPath, err)
	}
	if cfg.Version() != config.Version1 {
		return fmt.Errorf(
			"unsupported config version %s", cfg.Version())
	}

	oldConfig := cfg.(*config.V1)
	needsUpgrade, err := oldConfig.HasBcryptPasswords()
	if err != nil {
		return err
	}
	if !needsUpgrade {
		fmt.Printf("Config file %s is already the latest version (%s).\n",
			kbpConfigPath, cfg.Version())
		return nil
	}

	confirmed, err := promptConfirm(prompter,
		"You are about to migrate some password hashes in your "+
			"kbpages config file from bcrypt to sha256. You will be "+
			"prompted to enter passwords for each user one by one. "+
			"If you don't know the password for any user(s), you may "+
			"enter new passwords for them. Continue?", true)
	if err != nil {
		return err
	}
	if !confirmed {
		return fmt.Errorf("not confirmed")
	}

	newConfig := config.DefaultV1()
	for p, acl := range oldConfig.ACLs {
		if newConfig.ACLs == nil {
			newConfig.ACLs = make(map[string]config.AccessControlV1)
		}
		// shadow copy since oldConfig is one-time use anyway
		newConfig.ACLs[p] = acl
	}
	for user := range oldConfig.Users {
		if newConfig.Users == nil {
			newConfig.Users = make(map[string]string)
		}
		newConfig.Users[user], err = migrateUserToSHA256Hash(
			prompter, user, oldConfig)
		if err != nil {
			return fmt.Errorf("migrating to sha256 error: %v", err)
		}
	}
	return confirmAndWrite(originalConfigStr, newConfig,
		kbpConfigPath, prompter)
}

func upgradeToSHA256(c *cli.Context) {
	term, err := minterm.New()
	if err != nil {
		fmt.Fprintf(os.Stderr, "opening terminal error: %s\n", err)
		os.Exit(1)
	}
	if err = upgradeToSHA256WithPrompter(c.GlobalString("dir"), term); err != nil {
		fmt.Fprintf(os.Stderr, "upgrading to SHA256 error: %s\n", err)
		os.Exit(1)
	}
}

var upgradeCmd = cli.Command{
	Name:      "upgrade",
	Usage:     "upgrade config file to the latest version",
	UsageText: "upgrade",
	Action:    upgradeToSHA256,
}
