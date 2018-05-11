// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/keybase/client/go/minterm"
	"github.com/keybase/kbfs/libpages/config"
	"github.com/urfave/cli"
)

func migrateUserToSHA256Hash(p prompter, username string, oldConfig config.Config) (sha256Hash string) {
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

func upgradeToV2WithPrompter(kbpConfigDir string, prompter prompter) (err error) {
	kbpConfigPath, err := kbpConfigPath(kbpConfigDir)
	if err != nil {
		return err
	}
	f, err := os.Open(kbpConfigPath)
	switch {
	case err == nil:
		cfg, originalConfigStr, err := readConfigAndClose(f)
		if err != nil {
			return fmt.Errorf(
				"reading config file %s error: %v", kbpConfigPath, err)
		}
		switch cfg.Version() {
		case config.Version1:
			confirmed, err := promptConfirm(prompter, fmt.Sprintf(
				"You are about to upgrade your kbpages config file from "+
					"%s to %s. If you had username/password pairs in your "+
					"old config file, you will be prompted to enter "+
					"passwords for each user one by one. If you don't know "+
					"the password for any user(s), you may enter new "+
					"passwords for them. Continue?",
				config.Version1Str, config.Version2Str), true)
			if err != nil {
				return err
			}
			if !confirmed {
				return fmt.Errorf("not confirmed")
			}

			oldConfig := cfg.(*config.V1)
			newConfig := config.DefaultV2()
			for p, acl := range oldConfig.ACLs {
				if newConfig.ACLs == nil {
					newConfig.ACLs = make(map[string]config.AccessControlV1)
				}
				// shadow copy since oldConfig is on-time use anyway
				newConfig.ACLs[p] = acl
			}
			for user := range oldConfig.Users {
				if newConfig.Users == nil {
					newConfig.Users = make(map[string]string)
				}
				newConfig.Users[user] = migrateUserToSHA256Hash(
					prompter, user, oldConfig)
			}
			if err = confirmAndWrite(originalConfigStr, newConfig,
				kbpConfigPath, prompter); err != nil {
				return err
			}
			return nil
		case config.Version2:
			fmt.Printf("Config file %s is already the latest version (%s).\n",
				kbpConfigPath, cfg.Version())
			return nil
		default:
			return fmt.Errorf(
				"unsupported config version %s", cfg.Version())
		}
	case os.IsNotExist(err):
		return fmt.Errorf("no kbpages config file exists in %s", kbpConfigDir)
	default:
		return fmt.Errorf("open file %s error: %v", kbpConfigPath, err)
	}
}

func upgradeToV2(c *cli.Context) {
	term, err := minterm.New()
	if err != nil {
		fmt.Fprintf(os.Stderr, "opening terminal error: %s\n", err)
		os.Exit(1)
	}
	if err = upgradeToV2WithPrompter(c.GlobalString("dir"), term); err != nil {
		fmt.Fprintf(os.Stderr, "upgrading to V2 error: %s\n", err)
		os.Exit(1)
	}
}

var upgradeCmd = cli.Command{
	Name:      "upgrade",
	Usage:     "upgrade config file to the latest version",
	UsageText: "upgrade",
	Action:    upgradeToV2,
}
