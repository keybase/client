// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
)

var ErrSecretForUserNotFound = NotFoundError{Msg: "No secret found for user"}

type SecretStoreFile struct {
	dir          string
	notifyCreate func(NormalizedUsername)
}

var _ SecretStoreAll = (*SecretStoreFile)(nil)

func NewSecretStoreFile(dir string) *SecretStoreFile {
	return &SecretStoreFile{dir: dir}
}

func (s *SecretStoreFile) RetrieveSecret(username NormalizedUsername) (LKSecFullSecret, error) {
	secret, err := ioutil.ReadFile(s.userpath(username))
	if err != nil {
		if os.IsNotExist(err) {
			return LKSecFullSecret{}, ErrSecretForUserNotFound
		}

		return LKSecFullSecret{}, err
	}

	return newLKSecFullSecretFromBytes(secret)
}

func (s *SecretStoreFile) StoreSecret(username NormalizedUsername, secret LKSecFullSecret) error {
	if err := os.MkdirAll(s.dir, 0700); err != nil {
		return err
	}

	f, err := ioutil.TempFile(s.dir, username.String())
	if err != nil {
		return err
	}

	// remove the temp file if it still exists at the end of this function
	defer os.Remove(f.Name())

	if runtime.GOOS != "windows" {
		// os.Fchmod not supported on windows
		if err := f.Chmod(0600); err != nil {
			return err
		}
	}
	if _, err := f.Write(secret.Bytes()); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}

	final := s.userpath(username)

	exists, err := FileExists(final)
	if err != nil {
		return err
	}

	if err := os.Rename(f.Name(), final); err != nil {
		return err
	}

	if err := os.Chmod(final, 0600); err != nil {
		return err
	}

	// if we just created the secret store file for the
	// first time, notify anyone interested.
	if !exists && s.notifyCreate != nil {
		s.notifyCreate(username)
	}

	return nil
}

func (s *SecretStoreFile) ClearSecret(username NormalizedUsername) error {
	if err := os.Remove(s.userpath(username)); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	return nil
}

func (s *SecretStoreFile) GetUsersWithStoredSecrets() ([]string, error) {
	files, err := filepath.Glob(filepath.Join(s.dir, "*.ss"))
	if err != nil {
		return nil, err
	}
	users := make([]string, len(files))
	for i, f := range files {
		users[i] = stripExt(filepath.Base(f))
	}
	return users, nil
}

func (s *SecretStoreFile) GetApprovalPrompt() string {
	return "Remember login key"
}

func (s *SecretStoreFile) GetTerminalPrompt() string {
	return "Remember your login key?"
}

func (s *SecretStoreFile) userpath(username NormalizedUsername) string {
	return filepath.Join(s.dir, fmt.Sprintf("%s.ss", username))
}

func stripExt(path string) string {
	for i := len(path) - 1; i >= 0 && !os.IsPathSeparator(path[i]); i-- {
		if path[i] == '.' {
			return path[:i]
		}
	}
	return ""
}
