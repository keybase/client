// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFishyMsgpack(t *testing.T) {
	// This message has a duplicate key ("detached") in the top-level map
	info, err := DecodeArmoredNaclSigInfoPacket(`
hKRib2R5hqhkZXRhY2hlZMOoZGV0YWNoZWTCqWhhc2hfdHlwZQqja2V5xCMBIHPpctUn+7QopWm+
n1CVw28iikWy6ybCMUUdVRijfKQjCqdwYXlsb2FkxQPteyJib2R5Ijp7ImRldmljZSI6eyJpZCI6
IjA1Nzg0M2MyMDI1MTkyNmFjYzBkNWRiMzEyNjk3OTE4Iiwia2lkIjoiMDEyMTM3OWQ1MzcwYWVi
NGU5ZjdhYTRiNTI3MGY1ZTQ4ODA4NWE2NDdlMGRiMjQ3N2VkZDNmM2M1MGUzZDE0ZjQwNGYwYSIs
InN0YXR1cyI6MX0sImtleSI6eyJlbGRlc3Rfa2lkIjoiMDEyMGM3YTk0YzQ0Mjc2MDk1ZTczNjVm
NDliNjdhZTY4ZjdiY2JjODA1YzU4Mjc5N2Y2OTBiNjdiMDhmMDVlZGZlMWIwYSIsImhvc3QiOiJr
ZXliYXNlLmlvIiwia2lkIjoiMDEyMDczZTk3MmQ1MjdmYmI0MjhhNTY5YmU5ZjUwOTVjMzZmMjI4
YTQ1YjJlYjI2YzIzMTQ1MWQ1NTE4YTM3Y2E0MjMwYSIsInVpZCI6ImEwOTE1NTIxMDUzMmQ5NjA4
MWM0YTNhOTljNjQ4NDE5IiwidXNlcm5hbWUiOiJsd3BwXzQyMmFiNzk4NDcifSwic3Via2V5Ijp7
ImtpZCI6IjAxMjEzNzlkNTM3MGFlYjRlOWY3YWE0YjUyNzBmNWU0ODgwODVhNjQ3ZTBkYjI0Nzdl
ZGQzZjNjNTBlM2QxNGY0MDRmMGEiLCJwYXJlbnRfa2lkIjoiMDEyMDczZTk3MmQ1MjdmYmI0Mjhh
NTY5YmU5ZjUwOTVjMzZmMjI4YTQ1YjJlYjI2YzIzMTQ1MWQ1NTE4YTM3Y2E0MjMwYSJ9LCJ0eXBl
Ijoic3Via2V5IiwidmVyc2lvbiI6MX0sImNsaWVudCI6eyJuYW1lIjoia2V5YmFzZS5pbyBnbyBj
bGllbnQiLCJ2ZXJzaW9uIjoiMS4wLjAifSwiY3RpbWUiOjE0NDM0NjU5NDMsImV4cGlyZV9pbiI6
NTA0NTc2MDAwLCJtZXJrbGVfcm9vdCI6eyJjdGltZSI6MTQ0MzQ2NTk0MywiaGFzaCI6IjhlYjMz
YjA2YzFlMDIyMWFjYmFjZTMwNmQyM2VhMWQ5MjJiYWFhY2M2YWJiZDI3YzM5Y2Y2M2JjYzI2NzM0
ZWY0ODUwY2Y4NzZhZmU2OTE1Nzg0OTg0MTNlMmU5NzQzYjc5Yjk3YmUxNjFlYzA4ZGI0Y2YyOTZi
ZDVlOThiNWZlIiwic2Vxbm8iOjU2M30sInByZXYiOiJlZTAwNzg1ODI0NmFkZjg4NTU5NzY2ZjE2
NGQwYjE5NTMwMzIwOWNiZDgyYWZhN2ZjNmRlZDE4YjQ5YjdiNmIyIiwic2Vxbm8iOjQsInRhZyI6
InNpZ25hdHVyZSJ9o3NpZ8RAbe4i3mDpfo1ECOcd0XU1JE7lRgkPUHQq7WLEEh5LbO5IAZHSm2zY
tuX4LPcEa+72KyrsweuAJravU8SjgL/gAKhzaWdfdHlwZSCjdGFnzQICp3ZlcnNpb24B
`)
	require.IsType(t, err, FishyMsgpackError{}, "info=%+v, err+%+v", info, err)
}

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
