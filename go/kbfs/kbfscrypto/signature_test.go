// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"testing"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
)

// Test that Verify() rejects various types of bad signatures.
func TestVerifyFailures(t *testing.T) {
	signingKey := MakeFakeSigningKeyOrBust("client sign")

	msg := []byte("message")
	sigInfo := signingKey.Sign(msg)

	// Wrong version.

	sigInfoWrongVersion := sigInfo.DeepCopy()
	sigInfoWrongVersion.Version = 0
	err := Verify(msg, sigInfoWrongVersion)
	assert.Equal(t, UnknownSigVer{Ver: sigInfoWrongVersion.Version},
		errors.Cause(err))

	// Corrupt key.

	sigInfoCorruptKey := sigInfo.DeepCopy()
	sigInfoCorruptKey.VerifyingKey = MakeVerifyingKey("")
	err = Verify(msg, sigInfoCorruptKey)
	assert.Equal(t, libkb.KeyCannotVerifyError{}, errors.Cause(err))

	// Wrong sizes.

	shortSigInfo := sigInfo.DeepCopy()
	shortSigInfo.Signature = shortSigInfo.Signature[:len(shortSigInfo.Signature)-1]
	err = Verify(msg, shortSigInfo)
	assert.Equal(t, kbcrypto.VerificationError{}, errors.Cause(err))

	longSigInfo := sigInfo.DeepCopy()
	longSigInfo.Signature = append(longSigInfo.Signature, byte(0))
	err = Verify(msg, longSigInfo)
	assert.Equal(t, kbcrypto.VerificationError{}, errors.Cause(err))

	// Corrupt signature.

	corruptSigInfo := sigInfo.DeepCopy()
	corruptSigInfo.Signature[0] = ^sigInfo.Signature[0]
	err = Verify(msg, corruptSigInfo)
	assert.Equal(t, kbcrypto.VerificationError{}, errors.Cause(err))

	// Wrong key.

	sigInfoWrongKey := sigInfo.DeepCopy()
	sigInfoWrongKey.VerifyingKey = MakeFakeVerifyingKeyOrBust("wrong key")
	err = Verify(msg, sigInfoWrongKey)
	assert.Equal(t, kbcrypto.VerificationError{}, errors.Cause(err))

	// Corrupt message.

	corruptMsg := append(msg, []byte("corruption")...)
	err = Verify(corruptMsg, sigInfo)
	assert.Equal(t, kbcrypto.VerificationError{}, errors.Cause(err))
}
