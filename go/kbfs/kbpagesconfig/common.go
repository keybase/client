// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/kbfs/libpages/config"
	"github.com/sergi/go-diff/diffmatchpatch"
)

type prompter interface {
	Prompt(string) (string, error)
	PromptPassword(string) (string, error)
}

// Not go-routine safe!
type kbpConfigEditor struct {
	kbpConfigPath     string
	kbpConfig         *config.V1
	originalConfigStr string
	prompter          prompter
}

func readConfigAndClose(from io.ReadCloser) (
	cfg config.Config, str string, err error) {
	defer from.Close()
	buf := &bytes.Buffer{}
	if cfg, err = config.ParseConfig(io.TeeReader(from, buf)); err != nil {
		return nil, "", err
	}
	return cfg, buf.String(), nil
}

func kbpConfigPath(kbpConfigDir string) (path string, err error) {
	fi, err := os.Stat(kbpConfigDir)
	if err != nil {
		return "", fmt.Errorf("stat %q error: %v", kbpConfigDir, err)
	}
	if !fi.IsDir() {
		return "", fmt.Errorf("%q is not a directory", kbpConfigDir)
	}
	return filepath.Join(kbpConfigDir, config.DefaultConfigFilename), nil
}

func promptConfirm(p prompter, text string, defaultYes bool) (confirmed bool, err error) {
	prompt := "(y/N)"
	if defaultYes {
		prompt = "(Y/n)"
	}
	input, err := p.Prompt(fmt.Sprintf("%s %s: ", text, prompt))
	if err != nil {
		return false, fmt.Errorf("getting confirmation error: %v", err)
	}
	switch strings.ToLower(input) {
	case "y":
		return true, nil
	case "n":
		return false, nil
	case "":
		return defaultYes, nil
	default:
		return false, errors.New("getting confirmation error")
	}
}

func confirmAndWrite(
	originalConfigStr string,
	newConfig config.Config,
	configPath string,
	p prompter) (err error) {
	buf := &bytes.Buffer{}
	if err := newConfig.Encode(buf, true); err != nil {
		return fmt.Errorf("encoding config error: %v", err)
	}
	newConfigStr := buf.String()
	if newConfigStr == originalConfigStr {
		fmt.Println("no change is made to the config")
		return nil
	}

	// print the diff
	d := diffmatchpatch.New()
	fmt.Println(
		d.DiffPrettyText(
			d.DiffMain(originalConfigStr, newConfigStr, true)))

	confirmed, err := promptConfirm(p, fmt.Sprintf(
		"confirm writing above changes to %s?", configPath), false)
	if err != nil {
		return err
	}
	if !confirmed {
		return fmt.Errorf("not confirmed")
	}

	// Write the new config to kbpConfigPath.
	f, err := os.Create(configPath)
	if err != nil {
		return fmt.Errorf(
			"opening file [%s] error: %v", configPath, err)
	}
	defer f.Close()
	if _, err = f.WriteString(newConfigStr); err != nil {

		return fmt.Errorf(
			"writing config to file [%s] error: %v", configPath, err)
	}
	if err = f.Close(); err != nil {
		return fmt.Errorf(
			"closing file [%s] error: %v", configPath, err)
	}

	return nil
}

const randomPasswordBytes = 12 // 96 bits entropy
func generateRandomPassword() (password string, err error) {
	bytes := make([]byte, randomPasswordBytes)
	n, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("reading random bytes error: %v", err)
	}
	if n != randomPasswordBytes {
		return "", errors.New("reading random bytes error")
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
