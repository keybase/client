// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"errors"
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

func (s *SecretStoreFile) retrieveSecretV2(username NormalizedUsername) (LKSecFullSecret, error) {
	xor, err := ioutil.ReadFile(s.userpathV2(username))
	if err != nil {
		if os.IsNotExist(err) {
			return LKSecFullSecret{}, ErrSecretForUserNotFound
		}

		return LKSecFullSecret{}, err
	}

	noise, err := ioutil.ReadFile(s.noisepathV2(username))
	if err != nil {
		if os.IsNotExist(err) {
			return LKSecFullSecret{}, ErrSecretForUserNotFound
		}

		return LKSecFullSecret{}, err
	}

	secret, err := s.noiseXOR(xor, noise)
	if err != nil {
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

func (s *SecretStoreFile) noiseXOR(secret, noise []byte) ([]byte, error) {
	sum := sha256.Sum256(noise)
	if len(sum) != len(secret) {
		return nil, errors.New("LKSecLen or sha256.Size is no longer 32")
	}

	xor := make([]byte, len(sum))
	for i := 0; i < len(sum); i++ {
		xor[i] = sum[i] ^ secret[i]
	}

	return xor, nil
}

func (s *SecretStoreFile) storeSecretV2(username NormalizedUsername, secret LKSecFullSecret) error {
	noise, err := RandBytes(1024 * 1024 * 2)
	if err != nil {
		return err
	}
	xor, err := s.noiseXOR(secret.Bytes(), noise)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(s.dir, 0700); err != nil {
		return err
	}

	fsec, err := ioutil.TempFile(s.dir, username.String())
	if err != nil {
		return err
	}
	fnoise, err := ioutil.TempFile(s.dir, username.String())
	if err != nil {
		return err
	}

	// remove the temp file if it still exists at the end of this function
	defer os.Remove(fsec.Name())
	defer os.Remove(fnoise.Name())

	if runtime.GOOS != "windows" {
		// os.Fchmod not supported on windows
		if err := fsec.Chmod(0600); err != nil {
			return err
		}
		if err := fnoise.Chmod(0600); err != nil {
			return err
		}
	}
	if _, err := fsec.Write(xor); err != nil {
		return err
	}
	if err := fsec.Close(); err != nil {
		return err
	}
	if _, err := fnoise.Write(noise); err != nil {
		return err
	}
	if err := fnoise.Close(); err != nil {
		return err
	}

	finalSec := s.userpathV2(username)
	finalNoise := s.noisepathV2(username)

	exists, err := FileExists(finalSec)
	if err != nil {
		return err
	}

	if exists {
		// shred the existing secret
		if err := s.clearSecretV2(username); err != nil {
			return err
		}
	}

	if err := os.Rename(fsec.Name(), finalSec); err != nil {
		return err
	}
	if err := os.Rename(fnoise.Name(), finalNoise); err != nil {
		return err
	}

	if err := os.Chmod(finalSec, 0600); err != nil {
		return err
	}
	if err := os.Chmod(finalNoise, 0600); err != nil {
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
	// try both
	errV1 := s.clearSecretV1(username)
	errV2 := s.clearSecretV2(username)

	if errV1 != nil {
		return errV1
	}
	if errV2 != nil {
		return errV2
	}
	return nil
}

func (s *SecretStoreFile) clearSecretV1(username NormalizedUsername) error {
	if err := os.Remove(s.userpath(username)); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	return nil
}

func (s *SecretStoreFile) clearSecretV2(username NormalizedUsername) error {
	exists, err := FileExists(s.userpathV2(username))
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}

	for i := 0; i < 3; i++ {
		noise, err := RandBytes(1024 * 1024 * 2)
		if err != nil {
			return err
		}
		if err := ioutil.WriteFile(s.noisepathV2(username), noise, 0600); err != nil {
			return err
		}
	}

	if err := os.Remove(s.noisepathV2(username)); err != nil {
		return err
	}
	if err := os.Remove(s.userpathV2(username)); err != nil {
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

func (s *SecretStoreFile) userpath(username NormalizedUsername) string {
	return filepath.Join(s.dir, fmt.Sprintf("%s.ss", username))
}

func (s *SecretStoreFile) userpathV2(username NormalizedUsername) string {
	return filepath.Join(s.dir, fmt.Sprintf("%s.ss2", username))
}

func (s *SecretStoreFile) noisepathV2(username NormalizedUsername) string {
	return filepath.Join(s.dir, fmt.Sprintf("%s.ns2", username))
}

func stripExt(path string) string {
	for i := len(path) - 1; i >= 0 && !os.IsPathSeparator(path[i]); i-- {
		if path[i] == '.' {
			return path[:i]
		}
	}
	return ""
}
