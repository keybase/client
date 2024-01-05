// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"crypto/rand"
	"encoding/base32"
	"strings"
)

var randRead = rand.Read

// RandomID returns random ID (base32) string with prefix, using 256 bits as
// recommended by tptacek: https://gist.github.com/tqbf/be58d2d39690c3b366ad
func RandomID(prefix string) (string, error) {
	buf, err := RandBytes(32)
	if err != nil {
		return "", err
	}
	str := base32.StdEncoding.EncodeToString(buf)
	str = strings.ReplaceAll(str, "=", "")
	str = prefix + str
	return str, nil
}

// RandBytes returns random bytes of length
func RandBytes(length int) ([]byte, error) {
	buf := make([]byte, length)
	if _, err := randRead(buf); err != nil {
		return nil, err
	}
	return buf, nil
}
