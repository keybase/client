// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseConfig(t *testing.T) {
	config := &V1{
		Common: Common{
			Version: Version1Str,
		},
		Users: map[string][]byte{
			"alice": generatePasswordHashForTestOrBust(t, "12345"),
			"bob":   generatePasswordHashForTestOrBust(t, "54321"),
		},
		ACLs: map[string]AccessControlV1{
			"/alice-and-bob": AccessControlV1{
				WhitelistAdditionalPermissions: map[string]string{
					"alice": PermReadAndList,
					"bob":   PermRead,
				},
			},
		},
	}
	buf := &bytes.Buffer{}
	err := json.NewEncoder(buf).Encode(config)
	require.NoError(t, err)
	parsed, err := ParseConfig(buf)
	require.NoError(t, err)
	require.Equal(t, config, parsed)
}
