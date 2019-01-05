// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

type HashType int

// OpenPGP hash IDs, taken from http://tools.ietf.org/html/rfc4880#section-9.4
const (
	HashPGPMd5       HashType = 1
	HashPGPSha1      HashType = 2
	HashPGPRipemd160 HashType = 3
	HashPGPSha256    HashType = 8
	HashPGPSha384    HashType = 9
	HashPGPSha512    HashType = 10
	HashPGPSha224    HashType = 11
)
