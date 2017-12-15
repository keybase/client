// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"errors"
	"io"
	"io/ioutil"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDecryptErrorAtEOF(t *testing.T) {
	plaintext := randomMsg(t, 128)
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)

	senderSigningPrivKey := makeSigningKey(t, keyring)

	sealed, err := SigncryptSeal(plaintext, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	var reader io.Reader = bytes.NewReader(sealed)
	errAtEOF := errors.New("err at EOF")
	reader = errAtEOFReader{reader, errAtEOF}
	_, stream, err := NewSigncryptOpenStream(reader, keyring, nil)
	require.NoError(t, err)

	msg, err := ioutil.ReadAll(stream)
	require.Equal(t, errAtEOF, err)

	// Since the bytes are still authenticated, the decrypted
	// message should still compare equal to the original input.
	require.Equal(t, plaintext, msg)
}
