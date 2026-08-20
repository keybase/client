// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"context"
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type testStreamReader struct {
	*bytes.Reader
}

func (testStreamReader) Close() error { return nil }

func TestExportedStreamsReadBounds(t *testing.T) {
	streams := NewExportedStreams()
	stream := streams.ExportReader(testStreamReader{bytes.NewReader([]byte("hello"))})

	_, err := streams.Read(context.Background(), keybase1.ReadArg{S: stream, Sz: -1})
	require.Error(t, err)

	_, err = streams.Read(context.Background(), keybase1.ReadArg{S: stream, Sz: maxExportedStreamReadSize + 1})
	require.Error(t, err)

	buf, err := streams.Read(context.Background(), keybase1.ReadArg{S: stream, Sz: 5})
	require.NoError(t, err)
	require.Equal(t, []byte("hello"), buf)

	buf, err = streams.Read(context.Background(), keybase1.ReadArg{S: stream, Sz: 0})
	require.NoError(t, err)
	require.Empty(t, buf)
}
