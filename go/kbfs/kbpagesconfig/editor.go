// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/keybase/client/go/kbfs/libpages/config"
	"github.com/keybase/client/go/minterm"
)

func newKBPConfigEditorWithPrompter(kbpConfigDir string, p prompter) (
	*kbpConfigEditor, error) {
	kbpConfigPath, err := kbpConfigPath(kbpConfigDir)
	if err != nil {
		return nil, err
	}
	editor := &kbpConfigEditor{kbpConfigPath: kbpConfigPath, prompter: p}
	f, err := os.Open(kbpConfigPath)
	switch {
	case err == nil:
		var cfg config.Config
		cfg, editor.originalConfigStr, err = readConfigAndClose(f)
		if err != nil {
			return nil, fmt.Errorf(
				"reading config file %s error: %v", kbpConfigPath, err)
		}
		switch cfg.Version() {
		case config.Version1:
			editor.kbpConfig = cfg.(*config.V1)
			needsUpgrade, err := editor.kbpConfig.HasBcryptPasswords()
			if err != nil {
				return nil, err
			}
			if needsUpgrade {
				return nil, errors.New(
					"config has bcrypt password hashes. Please run " +
						"`kbpagesconfig upgrade` to migrate to sha256")
			}
		default:
			return nil, fmt.Errorf(
				"unsupported config version %s", cfg.Version())
		}
	case os.IsNotExist(err):
		editor.kbpConfig = config.DefaultV1()
	default:
		return nil, fmt.Errorf(
			"open file %s error: %v", kbpConfigPath, err)
	}
	return editor, nil
}

func newKBPConfigEditor(kbpConfigDir string) (*kbpConfigEditor, error) {
	term, err := minterm.New()
	if err != nil {
		return nil, fmt.Errorf("opening terminal error: %s", err)
	}
	return newKBPConfigEditorWithPrompter(kbpConfigDir, term)
}

func (e *kbpConfigEditor) confirmAndWrite() error {
	if err := e.kbpConfig.Validate(); err != nil {
		return fmt.Errorf("new config would not be valid: %v", err)
	}
	return confirmAndWrite(
		e.originalConfigStr, e.kbpConfig, e.kbpConfigPath, e.prompter)
}

func (e *kbpConfigEditor) setUser(username string, isAdd bool) error {
	_, userExists := e.kbpConfig.Users[username]
	if userExists && isAdd {
		return fmt.Errorf("user %s already exists", username)
	}
	if !userExists && !isAdd {
		return fmt.Errorf("user %s doesn't exist", username)
	}
	confirmedRandom, err := promptConfirm(e.prompter, fmt.Sprintf(
		"We can generate a random password for %s, or you can enter "+
			"a password. Since we use a fast hash function for password "+
			"hashing, we recommend generating random passwords with enough "+
			"entropy. Would you like to generate a random password now "+
			"(recommended)?", username), true)
	if err != nil {
		return fmt.Errorf("getting confirmation error: %v", err)
	}
	var password string
	if confirmedRandom {
		password, err = generateRandomPassword()
		if err != nil {
			return fmt.Errorf("generating random password error: %v", err)
		}
		confirmed, err := promptConfirm(e.prompter, fmt.Sprintf(
			"Here's the password for %s:\n\n\t%s\n\n"+
				"This is the only time you'll see it, so please write it "+
				"down or give it to %s. Continue?",
			username, password, username), false)
		if err != nil {
			return fmt.Errorf("getting confirmation error: %v", err)
		}
		if !confirmed {
			return errors.New("not confirmed")
		}
	} else {
		input, err := e.prompter.PromptPassword(fmt.Sprintf(
			"enter a password for %s: ", username))
		if err != nil {
			return fmt.Errorf("getting password error: %v", err)
		}
		password = strings.TrimSpace(input)
		if len(password) == 0 {
			return fmt.Errorf("empty password")
		}
	}
	hashed, err := config.GenerateSHA256PasswordHash(password)
	if err != nil {
		return err
	}
	if e.kbpConfig.Users == nil {
		e.kbpConfig.Users = make(map[string]string)
	}
	e.kbpConfig.Users[username] = (hashed)
	return nil
}

func (e *kbpConfigEditor) removeUser(username string) {
	delete(e.kbpConfig.Users, username)
}

func (e *kbpConfigEditor) setAnonymousPermission(
	permsStr string, pathStr string) error {
	if e.kbpConfig.ACLs == nil {
		e.kbpConfig.ACLs = make(map[string]config.AccessControlV1)
	}
	pathACL := e.kbpConfig.ACLs[pathStr]
	pathACL.AnonymousPermissions = permsStr
	e.kbpConfig.ACLs[pathStr] = pathACL
	return e.kbpConfig.Validate()
}

func (e *kbpConfigEditor) clearACL(pathStr string) {
	delete(e.kbpConfig.ACLs, pathStr)
}

func (e *kbpConfigEditor) setAdditionalPermission(
	username string, permsStr string, pathStr string) error {
	if e.kbpConfig.ACLs == nil {
		e.kbpConfig.ACLs = make(map[string]config.AccessControlV1)
	}
	pathACL := e.kbpConfig.ACLs[pathStr]
	if pathACL.WhitelistAdditionalPermissions == nil {
		// If permsStr is empty, we'd leave an empty permission entry behind.
		// But that's OK since it doesn't change any behavior, i.e., no
		// additional permission is granted for the user on the path. If user
		// really wants the entry gone, they can use the "remove" command.
		pathACL.WhitelistAdditionalPermissions = make(map[string]string)
	}
	pathACL.WhitelistAdditionalPermissions[username] = permsStr
	e.kbpConfig.ACLs[pathStr] = pathACL
	return e.kbpConfig.Validate()
}

func (e *kbpConfigEditor) removeUserFromACL(username string, pathStr string) {
	if e.kbpConfig.ACLs == nil {
		return
	}
	if e.kbpConfig.ACLs[pathStr].WhitelistAdditionalPermissions == nil {
		return
	}
	delete(e.kbpConfig.ACLs[pathStr].WhitelistAdditionalPermissions, username)
}

func (e *kbpConfigEditor) getUserOnPath(
	username string, pathStr string) (read, list bool, err error) {
	read, list, _, _, _, err = e.kbpConfig.GetPermissions(
		pathStr, &username)
	return read, list, err
}
