// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/updater"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testSignatureKeybot is "This is a test message" signed by keybot
const testSignatureKeybot = `BEGIN KEYBASE SALTPACK DETACHED SIGNATURE.
	kXR7VktZdyH7rvq v5wcIkPOwDJ1n11 M8RnkLKQGO2f3Bb fzCeMYz4S6oxLAy
	Cco4N255JFQSlh7 IZiojdPCOssX5DX pEcVEdujw3EsDuI FOTpFB77NK4tqLr
	Dgme7xtCaR4QRl2 hchPpr65lKLKSFy YVZcF2xUVN3gjpM vPFUMwg0JTBAG8x
	Z. END KEYBASE SALTPACK DETACHED SIGNATURE.
`

var testMessagePath, testMessage2Path string

func init() {
	_, filename, _, _ := runtime.Caller(0)
	testMessagePath = filepath.Join(filepath.Dir(filename), "../test/message1.txt")
	testMessage2Path = filepath.Join(filepath.Dir(filename), "../test/message2.txt")
}

// testSignatureInvalidSigner is "This is a test message" signed by gabrielh who
// is not in valid signing IDs.
const testSignatureInvalidSigner = `BEGIN KEYBASE SALTPACK DETACHED SIGNATURE.
	kXR7VktZdyH7rvq v5wcIkPOwGV4GkV Zj40Ut1jYS2euBu Ti6z39EdDX7Ne1P
	i0ToOCpSPXyNeSm Zr6r5UOEZnblXeU gLhEpUSRpLFMlKe MWkq61Yaa8XyFvt
	29NjGzUokNPHPB2 A97cMmFTeGP6Y5V RNRhtwBT3iJoyMv E9RcQhs1717z2aa
	c. END KEYBASE SALTPACK DETACHED SIGNATURE.`

func testContext(t *testing.T) *context {
	cfg, _ := testConfig(t)
	ctx := newContext(cfg, testLog)
	require.NotNil(t, ctx)
	return ctx
}

func testContextUpdate(path string, signature string) updater.Update {
	return updater.Update{
		Asset: &updater.Asset{
			Signature: signature,
			LocalPath: path,
		},
	}
}

func TestContext(t *testing.T) {
	ctx := testContext(t)

	// Check options not empty
	options := ctx.UpdateOptions()
	assert.NotEqual(t, options.Version, "")
}

func TestContextVerify(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping on windows")
	}
	ctx := testContext(t)
	testLog.Warningf("testMessagePath: %v", testMessagePath)
	err := ctx.Verify(testContextUpdate(testMessagePath, testSignatureKeybot))
	assert.NoError(t, err)
}

func TestContextVerifyFail(t *testing.T) {
	ctx := testContext(t)
	err := ctx.Verify(testContextUpdate(testMessage2Path, testSignatureInvalidSigner))
	require.Error(t, err)
}

func TestContextVerifyNoValidIDs(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping on windows")
	}
	ctx := testContext(t)
	err := ctx.Verify(testContextUpdate(testMessagePath, testSignatureInvalidSigner))
	require.Error(t, err)
	assert.Equal(t, "error verifying signature: unknown signer KID: 0120ad6ec4c0132ca7627b3c4d72c650323abec004da51dc086fd0ec2b4f82e6e4860a", err.Error())
}

func TestContextVerifyBadSignature(t *testing.T) {
	ctx := testContext(t)
	err := ctx.Verify(testContextUpdate(testMessagePath, "BEGIN KEYBASE SALTPACK DETACHED SIGNATURE. END KEYBASE SALTPACK DETACHED SIGNATURE."))
	require.Error(t, err)
}
