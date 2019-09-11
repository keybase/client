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

func TestParseConfigV1(t *testing.T) {
	config := &V1{
		Common: Common{
			Version: Version1Str,
		},
		Users: map[string]string{
			"alice": generateBcryptPasswordHashForTestOrBust(t, "12345"),
			"bob":   generateSHA256PasswordHashForTestOrBust(t, "54321"),
		},
		ACLs: map[string]AccessControlV1{
			"/alice-and-bob": {
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
	parsedV1, ok := parsed.(*V1)
	require.True(t, ok)
	require.Equal(t, config.ACLs, parsedV1.ACLs)
	require.Equal(t, config.Common, parsedV1.Common)
	require.Equal(t, config.Users, parsedV1.Users)
}
