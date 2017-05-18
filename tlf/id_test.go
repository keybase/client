// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
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
