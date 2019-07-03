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
	if err != nil {
		t.Fatal(err)
	}

	senderSigningKP, err := GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	var receiverKPs []NaclDHKeyPair
	var receiverPKs []NaclDHKeyPublic
	for i := 0; i < 12; i++ {
		kp, err := GenerateNaclDHKeyPair()
		if err != nil {
			t.Fatal(err)
		}
		receiverKPs = append(receiverKPs, kp)
		receiverPKs = append(receiverPKs, kp.Public)
	}

	nonReceiverKP, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

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
		t.Fatal(err)
	}

	ciphertext := buf.String()
	if !strings.HasPrefix(ciphertext, saltpack.MakeArmorHeader(saltpack.MessageTypeEncryption, KeybaseSaltpackBrand)) {
		t.Errorf("ciphertext doesn't have header: %s", ciphertext)
	}

	if !strings.HasSuffix(ciphertext, saltpack.MakeArmorFooter(saltpack.MessageTypeEncryption, KeybaseSaltpackBrand)+".\n") {
		t.Errorf("ciphertext doesn't have footer: %s", ciphertext)
	}

	for _, key := range receiverKPs {
		buf.Reset()

		// Create a keyring with only one key
		keyring := saltpackBasic.NewKeyring()
		keyring.ImportBoxKey((*[NaclDHKeysize]byte)(&key.Public), (*[NaclDHKeysize]byte)(key.Private))

		_, err = SaltpackDecrypt(m,
			strings.NewReader(ciphertext),
			&buf, keyring, nil, nil, saltpackkeystest.NewMockPseudonymResolver(t))
		if err != nil {
			t.Fatal(err)
		}

		plaintext := buf.String()
		if plaintext != message {
			t.Errorf("expected %s, got %s",
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
		require.Equal(t, decError.Cause, saltpack.ErrNoDecryptionKey)
	}
}
