// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"testing"
)

func TestNonceForPayloadKeyBoxV1(t *testing.T) {
	nonce1 := nonceForPayloadKeyBox(Version1(), 0)
	nonce2 := nonceForPayloadKeyBox(Version1(), 1)

	// The V1 MAC key doesn't depend on the index; this is fixed
	// in V2.
	if nonce2 != nonce1 {
		t.Errorf("nonce2 == %v != nonce1 == %v unexpectedly", nonce2, nonce1)
	}
}

func TestNonceForPayloadKeyBoxV2(t *testing.T) {
	nonce1a := nonceForPayloadKeyBoxV2(0)
	nonce1b := nonceForPayloadKeyBox(Version2(), 0)
	nonce2a := nonceForPayloadKeyBoxV2(1)
	nonce2b := nonceForPayloadKeyBox(Version2(), 1)

	if nonce1b != nonce1a {
		t.Errorf("nonce1b == %v != nonce1a == %v unexpectedly", nonce1b, nonce1a)
	}

	if nonce2b != nonce2a {
		t.Errorf("nonce2b == %v != nonce2a == %v unexpectedly", nonce2b, nonce2a)
	}

	if nonce2a == nonce1a {
		t.Errorf("nonce2a == nonce1a == %v unexpectedly", nonce1a)
	}
}

func TestNonceForMACKeyBoxV2(t *testing.T) {
	hash1 := headerHash{0x01}
	hash2 := headerHash{0x02}

	nonce1 := nonceForMACKeyBoxV2(hash1, false, 0)
	nonce2 := nonceForMACKeyBoxV2(hash2, false, 0)
	nonce3 := nonceForMACKeyBoxV2(hash1, true, 0)
	nonce4 := nonceForMACKeyBoxV2(hash1, false, 1)

	if nonce2 == nonce1 {
		t.Errorf("nonce2 == nonce1 == %v unexpectedly", nonce1)
	}

	if nonce3 == nonce1 {
		t.Errorf("nonce3 == nonce1 == %v unexpectedly", nonce1)
	}

	if nonce4 == nonce1 {
		t.Errorf("nonce4 == nonce1 == %v unexpectedly", nonce1)
	}
}
