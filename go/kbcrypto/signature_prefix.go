// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import "bytes"

type SignaturePrefix string

const (
	SignaturePrefixKBFS             SignaturePrefix = "Keybase-KBFS-1"
	SignaturePrefixSigchain         SignaturePrefix = "Keybase-Sigchain-1"
	SignaturePrefixSigchain3        SignaturePrefix = "Keybase-Sigchain-3"
	SignaturePrefixChatAttachment   SignaturePrefix = "Keybase-Chat-Attachment-1"
	SignaturePrefixNIST             SignaturePrefix = "Keybase-Auth-NIST-1"
	SignaturePrefixTeamStore        SignaturePrefix = "Keybase-TeamStore-1"
	SignaturePrefixNISTWebAuthToken SignaturePrefix = "Keybase-Auth-NIST-Web-Token-1"
	// Chat prefixes for each MessageBoxedVersion.
	SignaturePrefixChatMBv1 SignaturePrefix = "Keybase-Chat-1"
	SignaturePrefixChatMBv2 SignaturePrefix = "Keybase-Chat-2"
)

func (p SignaturePrefix) IsWhitelisted() bool {
	if p.IsWhitelistedTest() {
		return true
	}
	switch p {
	case SignaturePrefixKBFS, SignaturePrefixSigchain, SignaturePrefixChatAttachment,
		SignaturePrefixNIST, SignaturePrefixChatMBv1, SignaturePrefixChatMBv2,
		SignaturePrefixSigchain3, SignaturePrefixTeamStore:
		return true
	default:
		return false
	}
}

func (p SignaturePrefix) HasNullByte() bool {
	return bytes.IndexByte([]byte(p), byte(0)) != -1
}

func (p SignaturePrefix) Prefix(msg []byte) []byte {
	prefix := append([]byte(p), 0)
	return append(prefix, msg...)
}
