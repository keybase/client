// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

// CheckDigest returns no error if digest matches file
func CheckDigest(digest string, path string, log Log) error {
	if digest == "" {
		return fmt.Errorf("Missing digest")
	}
	calcDigest, err := DigestForFileAtPath(path)
	if err != nil {
		return err
	}
	if calcDigest != digest {
		return fmt.Errorf("Invalid digest: %s != %s (%s)", calcDigest, digest, path)
	}
	log.Infof("Verified digest: %s (%s)", digest, path)
	return nil
}

// DigestForFileAtPath returns a SHA256 digest for file at specified path
func DigestForFileAtPath(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer Close(f)
	return Digest(f)
}

// Digest returns a SHA256 digest
func Digest(r io.Reader) (string, error) {
	hasher := sha256.New()
	if _, err := io.Copy(hasher, r); err != nil {
		return "", err
	}
	digest := hex.EncodeToString(hasher.Sum(nil))
	return digest, nil
}
