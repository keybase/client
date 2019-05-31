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

var redactTests = []struct {
	in  string
	out string
}{
	{"hello this is my feedback", "hello this is my feedback"},
	{"nope agent agent agent alcohol agent agent agent nope more feedback", "nope [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] nope more feedback"},
	{"nope agent nope agent agent alcohol agent agent nope more feedback", "nope agent nope [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] nope more feedback"},
	{"four in a row agent agent agent agent four in a row", "four in a row agent agent agent agent four in a row"},
	{"agent agent agent agent agent", "[REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED]"},
	{"agent agent agent agent agent offset", "[REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] offset"},
	{"offset agent agent agent agent agent", "offset [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED]"},
	{"1 2 agent agent agent 3 agent agent 4 agent agent agent agent agent 5 agent agent agent agent agent agent agent agent 6 7 8 9 10", "1 2 agent agent agent 3 agent agent 4 [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] 5 [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] 6 7 8 9 10"},
	{`tricky my paper key is in quotes: "agent agent agent agent agent agent" see!`, `tricky my paper key is in quotes: [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] see!`},
}

func TestRedactPaperKeys(t *testing.T) {
	for _, tt := range redactTests {
		t.Run(tt.in, func(t *testing.T) {
			ret := redactPotentialPaperKeys(tt.in)
			if ret != tt.out {
				t.Errorf("got %q; want %q", ret, tt.out)
			}
		})
	}
}
