// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type testPacketable struct{}

func (*testPacketable) GetTagAndVersion() (PacketTag, PacketVersion) {
	return TagSignature, KeybasePacketV1
}

// Guard against unexpected codec encoding changes, in particular for
// ints.
func TestHardcodedPacketEncode(t *testing.T) {
	var nilPtr *testPacketable
	p, err := newKeybasePacket(nilPtr)
	require.NoError(t, err)

	p.Hash = nil

	bytes, err := p.encode()
	require.NoError(t, err)
	// In particular, {0xcd, 0x2, 0x2} shouldn't change to
	// {0xd1, 0x2, 0x2}.
	expectedBytes := []byte{0x83, 0xa4, 0x62, 0x6f, 0x64, 0x79, 0xc0, 0xa3, 0x74, 0x61, 0x67, 0xcd, 0x2, 0x2, 0xa7, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x1}
	require.Equal(t, expectedBytes, bytes)
}
