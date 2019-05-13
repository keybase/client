// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package status

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/stretchr/testify/require"
)

func TestMergeExtendedStatus(t *testing.T) {
	tc := libkb.SetupTest(t, "MergedExtendedStatus", 1)
	defer tc.Cleanup()
	lsCtx := LogSendContext{
		Contextified: libkb.NewContextified(tc.G),
	}

	// invalid json is skipped
	fullStatus := lsCtx.mergeExtendedStatus("")
	require.Equal(t, fullStatus, "")

	// Status is merged in under the key 'status'
	status := `{"status":{"foo":"bar"}}`
	fullStatus = lsCtx.mergeExtendedStatus(status)
	require.True(t, strings.Contains(fullStatus, status))

	err := jsonw.EnsureMaxDepthBytesDefault([]byte(fullStatus))
	require.NoError(t, err)

	fullStatusMap := map[string]interface{}{}
	err = json.Unmarshal([]byte(fullStatus), &fullStatusMap)
	require.NoError(t, err)
	_, ok := fullStatusMap["status"]
	require.True(t, ok)
}

func TestFullStatus(t *testing.T) {
	tc := libkb.SetupTest(t, "FullStatus", 1)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)
	fstatus, err := GetFullStatus(mctx)
	require.NoError(t, err)
	require.NotNil(t, fstatus)
}
