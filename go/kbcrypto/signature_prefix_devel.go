// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build !production
// +build !production

package kbcrypto

const (
	SignaturePrefixTesting SignaturePrefix = "Keybase-Testing-1"
)

func (p SignaturePrefix) IsWhitelistedTest() bool {
	return p == SignaturePrefixTesting
}
