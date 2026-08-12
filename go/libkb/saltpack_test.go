// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"strings"
	"testing"

	"github.com/keybase/saltpack"
	saltpackBasic "github.com/keybase/saltpack/basic"
	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/saltpackkeystest"
)

type outputBuffer struct {
	bytes.Buffer
}

func (ob outputBuffer) Close() error {
	return nil
}

// Encrypt a message, and make sure recipients can decode it, and
// non-recipients can't decode it.
func TestSaltpackEncDec(t *testing.T) {
	tc := SetupTest(t, "TestSaltpackEncDec", 1)
	defer tc.Cleanup()

	m := NewMetaContextForTest(tc)

	senderKP, err := GenerateNaclDHKeyPair()
	require.NoError(t, err)

	senderSigningKP, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)

	var receiverKPs []NaclDHKeyPair
	var receiverPKs []NaclDHKeyPublic
	for range 12 {
		kp, err := GenerateNaclDHKeyPair()
		require.NoError(t, err)
		receiverKPs = append(receiverKPs, kp)
		receiverPKs = append(receiverPKs, kp.Public)
	}

	nonReceiverKP, err := GenerateNaclDHKeyPair()
	require.NoError(t, err)

	message := "The Magic Words are Squeamish Ossifrage"

	var buf outputBuffer

	arg := SaltpackEncryptArg{
		Source:        strings.NewReader(message),
		Sink:          &buf,
		Receivers:     receiverPKs,
		Sender:        senderKP,
		SenderSigning: senderSigningKP,
	}
	if err := SaltpackEncrypt(m, &arg); err != nil {
		require.NoError(t, err)
	}

	ciphertext := buf.String()
	require.True(t, strings.HasPrefix(ciphertext, saltpack.MakeArmorHeader(saltpack.MessageTypeEncryption, KeybaseSaltpackBrand)), "ciphertext doesn't have header: %s", ciphertext)

	require.True(t, strings.HasSuffix(ciphertext, saltpack.MakeArmorFooter(saltpack.MessageTypeEncryption, KeybaseSaltpackBrand)+".\n"), "ciphertext doesn't have footer: %s", ciphertext)

	for _, key := range receiverKPs {
		buf.Reset()

		// Create a keyring with only one key
		keyring := saltpackBasic.NewKeyring()
		keyring.ImportBoxKey((*[NaclDHKeysize]byte)(&key.Public), (*[NaclDHKeysize]byte)(key.Private))

		_, err = SaltpackDecrypt(m,
			strings.NewReader(ciphertext),
			&buf, keyring, nil, nil, saltpackkeystest.NewMockPseudonymResolver(t))
		require.NoError(t, err)

		plaintext := buf.String()
		if plaintext != message {
			require.Fail(t, "expected %s, got %s",
				message, plaintext)
		}
	}

	// Sender is a non-recipient, too.
	nonReceiverKPs := []NaclDHKeyPair{nonReceiverKP, senderKP}

	for _, key := range nonReceiverKPs {
		buf.Reset()

		// Create a keyring with only one key
		keyring := saltpackBasic.NewKeyring()
		keyring.ImportBoxKey((*[NaclDHKeysize]byte)(&key.Public), (*[NaclDHKeysize]byte)(key.Private))

		_, err = SaltpackDecrypt(m,
			strings.NewReader(ciphertext), &buf, keyring, nil, nil, saltpackkeystest.NewMockPseudonymResolver(t))
		// An unauthorized receiver trying to decrypt should receive an error
		decError := err.(DecryptionError)
		require.Equal(t, decError.Cause.Err, saltpack.ErrNoDecryptionKey)
	}
}
