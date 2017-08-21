// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"crypto/md5"
	"encoding/hex"
	"io"
	"os"
)

// ComputeEtag returns etag for a file at path
func ComputeEtag(path string) (string, error) {
	var result []byte
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer Close(file)

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(result)), nil
}
