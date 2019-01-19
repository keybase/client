// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestIDEncodeDecode(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	id := FakeID(1, Public)

	encodedID, err := codec.Encode(id)
	require.NoError(t, err)

	// See
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-bin
	// for why there are two bytes of overhead.
	const overhead = 2
	require.Equal(t, idByteLen+overhead, len(encodedID))

	var id2 ID
	err = codec.Decode(encodedID, &id2)
	require.NoError(t, err)

	require.Equal(t, id, id2)
}

func TestMakeIDFromTeam(t *testing.T) {
	privateTID := keybase1.MakeTestTeamID(1, false)
	publicTID := keybase1.MakeTestTeamID(2, true)

	epochIndex := idByteLen - 2
	check := func(ty Type, tid keybase1.TeamID, epoch byte) {
		id, err := MakeIDFromTeam(ty, tid, epoch)
		require.NoError(t, err)
		require.Equal(t, id.Type(), ty)
		require.Equal(t, tid.ToBytes()[:epochIndex], id.Bytes()[:epochIndex])
		require.Equal(t, epoch, id.Bytes()[epochIndex])
	}
	check(Private, privateTID, 0)
	check(Public, publicTID, 0)
	check(SingleTeam, privateTID, 0)
	check(Private, privateTID, 15)

	_, err := MakeIDFromTeam(Public, privateTID, 0)
	require.NotNil(t, err)
	_, err = MakeIDFromTeam(Private, publicTID, 0)
	require.NotNil(t, err)
	_, err = MakeIDFromTeam(SingleTeam, publicTID, 0)
	require.NotNil(t, err)
	_, err = MakeIDFromTeam(
		Private, keybase1.TeamID("extra"+privateTID.String()), 0)
	require.NotNil(t, err)
}
