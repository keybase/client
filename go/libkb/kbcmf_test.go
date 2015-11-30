// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"strings"
	"testing"

	"github.com/keybase/client/go/kbcmf"
)

type outputBuffer struct {
	bytes.Buffer
}

func (ob outputBuffer) Close() error {
	return nil
}

// Encrypt a message, and make sure recipients can decode it, and
// non-recipients can't decode it.
func TestKbcmfEncDec(t *testing.T) {
	senderKP, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	var receiverKPs [][]NaclDHKeyPair
	var receiverPKs [][]NaclDHKeyPublic
	for i := 0; i < 4; i++ {
		var tKP []NaclDHKeyPair
		var tPK []NaclDHKeyPublic
		for j := 0; j < 3; j++ {
			kp, err := GenerateNaclDHKeyPair()
			if err != nil {
				t.Fatal(err)
			}
			tKP = append(tKP, kp)
			tPK = append(tPK, kp.Public)
		}
		receiverKPs = append(receiverKPs, tKP)
		receiverPKs = append(receiverPKs, tPK)
	}

	nonReceiverKP, err := GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	message := "The Magic Words are Squeamish Ossifrage"

	var buf outputBuffer

	err = KBCMFEncrypt(
		strings.NewReader(message), &buf, receiverPKs, senderKP)
	if err != nil {
		t.Fatal(err)
	}

	ciphertext := buf.String()
	if !strings.HasPrefix(ciphertext, kbcmf.EncryptionArmorHeader) {
		t.Errorf("ciphertext doesn't have header: %s", ciphertext)
	}

	if !strings.HasSuffix(ciphertext, kbcmf.EncryptionArmorFooter+".\n") {
		t.Errorf("ciphertext doesn't have footer: %s", ciphertext)
	}

	for i := 0; i < len(receiverKPs); i++ {
		for j := 0; j < len(receiverKPs[i]); j++ {
			buf.Reset()
			err = KBCMFDecrypt(
				strings.NewReader(ciphertext),
				&buf, receiverKPs[i][j])
			if err != nil {
				t.Fatal(err)
			}

			plaintext := buf.String()
			if plaintext != message {
				t.Errorf("expected %s, got %s",
					message, plaintext)
			}

		}
	}

	// Sender is a non-recipient, too.
	nonReceiverKPs := []NaclDHKeyPair{nonReceiverKP, senderKP}

	for _, kp := range nonReceiverKPs {
		buf.Reset()
		err = KBCMFDecrypt(
			strings.NewReader(ciphertext), &buf, kp)
		if err != kbcmf.ErrNoDecryptionKey {
			t.Fatal(err)
		}
	}
}
