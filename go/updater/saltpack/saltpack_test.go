// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/keybase/go-logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testLog = &logging.Logger{Module: "test"}

var validCodeSigningKIDs = map[string]bool{
	"0120d7539e27e83a9c8caf8701199c6985c0a96801ff7cb69456e9b3a8a8446c66080a": true, // joshblum (saltine)
}

const message1 = "This is a test message\n"

// This is the output of running:
//
//	echo "This is a test message" | keybase sign -d
const signature1 = `BEGIN KEYBASE SALTPACK DETACHED SIGNATURE. kXR7VktZdyH7rvq
v5weRa8moXPeKBe e2YLT0PnyHzCrVi RbC1J5uJtYgYyLW eGg4qzsWqkXuVtJ yTsutKVn8DT97Oe
mnvASPWsbU2VjnR t4EChFoYF1RSi75 MvyyWify9iZldeI 0OTYM5yKLpbCrX5 yD0Tmjf2txwg7Jx
UVbWQUb01SmoAzq f. END KEYBASE SALTPACK DETACHED SIGNATURE.`

var testZipPath string

// keybase sign -d -i test.zip
const testZipSignature = `BEGIN KEYBASE SALTPACK DETACHED SIGNATURE.
kXR7VktZdyH7rvq v5weRa8moXPeKBe e2YLT0PnyHzCrVi RbC1J5uJtYgYyLW eGg4qzsWqkb7hcX
GTVc0vsEUVwBCly qhPdOL0mE19kfxg A4fMqpNGNTY0jtO iMpjwwuIyLBxkCC jHzMiJFskzluz2S
otWUI0nTu2vG2Fx Mgeyqm20Ug8j7Bi N. END KEYBASE SALTPACK DETACHED SIGNATURE.`

func init() {
	_, filename, _, _ := runtime.Caller(0)
	testZipPath = filepath.Join(filepath.Dir(filename), "../test/test.zip")
}

func TestVerify(t *testing.T) {
	reader := bytes.NewReader([]byte(message1))
	err := VerifyDetached(reader, signature1, validCodeSigningKIDs, testLog)
	assert.NoError(t, err)
}

func TestVerifyDetachedFileAtPath(t *testing.T) {
	err := VerifyDetachedFileAtPath(testZipPath, testZipSignature, validCodeSigningKIDs, testLog)
	assert.NoError(t, err)
}

func TestVerifyFail(t *testing.T) {
	invalid := bytes.NewReader([]byte("This is a test message changed\n"))
	err := VerifyDetached(invalid, signature1, validCodeSigningKIDs, testLog)
	require.EqualError(t, err, "invalid signature")
}

func TestVerifyFailDetachedFileAtPath(t *testing.T) {
	err := VerifyDetachedFileAtPath(testZipPath, testZipSignature, map[string]bool{}, testLog)
	require.Error(t, err)
}

func TestVerifyNoValidIDs(t *testing.T) {
	reader := bytes.NewReader([]byte(message1))
	err := VerifyDetached(reader, signature1, nil, testLog)
	require.EqualError(t, err, "unknown signer KID: 0120d7539e27e83a9c8caf8701199c6985c0a96801ff7cb69456e9b3a8a8446c66080a")
}

func TestVerifyBadValidIDs(t *testing.T) {
	var badCodeSigningKIDs = map[string]bool{
		"whatever": true,
	}

	reader := bytes.NewReader([]byte(message1))
	err := VerifyDetached(reader, signature1, badCodeSigningKIDs, testLog)
	require.EqualError(t, err, "unknown signer KID: 0120d7539e27e83a9c8caf8701199c6985c0a96801ff7cb69456e9b3a8a8446c66080a")
}

func TestVerifyNilInput(t *testing.T) {
	err := VerifyDetached(nil, signature1, validCodeSigningKIDs, testLog)
	require.EqualError(t, err, "no reader")
}

func TestVerifyNoSignature(t *testing.T) {
	reader := bytes.NewReader([]byte(message1))
	err := VerifyDetached(reader, "", validCodeSigningKIDs, testLog)
	require.Equal(t, io.ErrUnexpectedEOF, err)
}

type testSigningKey struct {
	kid []byte
}

func (t testSigningKey) ToKID() []byte {
	return t.kid
}

func (t testSigningKey) Verify(message []byte, signature []byte) error {
	panic("Unsupported")
}

func TestCheckNilSender(t *testing.T) {
	err := checkSender(nil, validCodeSigningKIDs, testLog)
	require.Error(t, err)
}

func TestCheckNoKID(t *testing.T) {
	err := checkSender(testSigningKey{kid: nil}, validCodeSigningKIDs, testLog)
	require.Error(t, err)
}

func TestVerifyNoFile(t *testing.T) {
	err := VerifyDetachedFileAtPath("/invalid", signature1, validCodeSigningKIDs, testLog)
	assert.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(), "open /invalid: "))
}
