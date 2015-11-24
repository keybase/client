// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"strings"
	"testing"
)

type outputBuffer struct {
	bytes.Buffer
}

func (ob outputBuffer) Close() error {
	return nil
}

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

	_, err = GenerateNaclDHKeyPair()
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

	output := buf.String()
	if !strings.HasPrefix(output, keybaseEncryptionArmorHeader) {
		t.Errorf("output doesn't have header: %s", output)
	}

	if !strings.HasSuffix(output, keybaseEncryptionArmorFooter+".\n") {
		t.Errorf("output doesn't have footer: %s", output)
	}
}
