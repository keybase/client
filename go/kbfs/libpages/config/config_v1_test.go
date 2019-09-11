// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConfigV1Default(t *testing.T) {
	config := DefaultV1()
	read, list,
		possibleRead, possibleList,
		realm, err := config.GetPermissions("/", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/", realm)
}

func TestConfigV1Invalid(t *testing.T) {
	err := (&V1{
		Common: Common{
			Version: Version1Str,
		},
		ACLs: map[string]AccessControlV1{
			"/": {
				WhitelistAdditionalPermissions: map[string]string{
					"alice": PermRead,
				},
			},
		},
	}).EnsureInit()
	require.Error(t, err)
	require.IsType(t, ErrUndefinedUsername{}, err)

	err = (&V1{
		Common: Common{
			Version: Version1Str,
		},
		ACLs: map[string]AccessControlV1{
			"/": {
				AnonymousPermissions: "",
			},
			"": {
				AnonymousPermissions: PermRead,
			},
		},
	}).EnsureInit()
	require.Error(t, err)
	require.IsType(t, ErrDuplicateAccessControlPath{}, err)

	err = (&V1{
		Common: Common{
			Version: Version1Str,
		},
		ACLs: map[string]AccessControlV1{
			"/foo": {
				AnonymousPermissions: "",
			},
			"/foo/../foo": {
				AnonymousPermissions: PermRead,
			},
		},
	}).EnsureInit()
	require.Error(t, err)
	require.IsType(t, ErrDuplicateAccessControlPath{}, err)

	err = (&V1{
		Common: Common{
			Version: Version1Str,
		},
		ACLs: map[string]AccessControlV1{
			"/": {
				AnonymousPermissions: "huh?",
			},
		},
	}).EnsureInit()
	require.Error(t, err)
	require.IsType(t, ErrInvalidPermissions{}, err)
}

func TestConfigV1Full(t *testing.T) {
	config := V1{
		Common: Common{
			Version: Version1Str,
		},
		Users: map[string]string{
			"alice": generateBcryptPasswordHashForTestOrBust(t, "12345"),
			"bob":   generateSHA256PasswordHashForTestOrBust(t, "54321"),
		},
		ACLs: map[string]AccessControlV1{
			"/": {
				AnonymousPermissions: "read,list",
			},
			"/alice-and-bob": {
				WhitelistAdditionalPermissions: map[string]string{
					"alice": PermReadAndList,
					"bob":   PermRead,
				},
			},
			"/bob": {
				AnonymousPermissions: "",
				WhitelistAdditionalPermissions: map[string]string{
					"bob": PermReadAndList,
				},
			},
			"/public": {
				AnonymousPermissions: PermReadAndList,
			},
			"/public/not-really": {
				AnonymousPermissions: "",
				WhitelistAdditionalPermissions: map[string]string{
					"alice": PermReadAndList,
				},
			},
			"/bob/dir/deep-dir/deep-deep-dir": {},
		},
	}

	ctx := context.Background()

	authenticated := config.Authenticate(ctx, "alice", "54321")
	require.False(t, authenticated)
	authenticated = config.Authenticate(ctx, "bob", "12345")
	require.False(t, authenticated)
	authenticated = config.Authenticate(ctx, "alice", "12345")
	require.True(t, authenticated)
	authenticated = config.Authenticate(ctx, "bob", "54321")
	require.True(t, authenticated)

	read, list, possibleRead, possibleList,
		realm, err := config.GetPermissions("/", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/", stringPtr("alice"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/", stringPtr("bob"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/", realm)

	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/alice-and-bob", nil)
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/alice-and-bob", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/alice-and-bob", stringPtr("alice"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/alice-and-bob", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/alice-and-bob", stringPtr("bob"))
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/alice-and-bob", realm)

	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob", nil)
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob", stringPtr("alice"))
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob", stringPtr("bob"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)

	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/public", nil)
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/public", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/public", stringPtr("alice"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/public", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/public", stringPtr("bob"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/public", realm)

	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/public/not-really", nil)
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/public/not-really", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/public/not-really", stringPtr("alice"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/public/not-really", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/public/not-really", stringPtr("bob"))
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/public/not-really", realm)

	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir", nil)
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir", stringPtr("alice"))
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir", stringPtr("bob"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)

	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir/sub", nil)
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir/sub", stringPtr("alice"))
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir/sub", stringPtr("bob"))
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.True(t, possibleRead)
	require.True(t, possibleList)
	require.Equal(t, "/bob", realm)

	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir/deep-dir/deep-deep-dir", nil)
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.False(t, possibleRead)
	require.False(t, possibleList)
	require.Equal(t, "/bob/dir/deep-dir/deep-deep-dir", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir/deep-dir/deep-deep-dir", stringPtr("alice"))
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.False(t, possibleRead)
	require.False(t, possibleList)
	require.Equal(t, "/bob/dir/deep-dir/deep-deep-dir", realm)
	read, list, possibleRead, possibleList,
		realm, err = config.GetPermissions("/bob/dir/deep-dir/deep-deep-dir", stringPtr("bob"))
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.False(t, possibleRead)
	require.False(t, possibleList)
	require.Equal(t, "/bob/dir/deep-dir/deep-deep-dir", realm)
}

func TestV1EncodeObjectKeyOrder(t *testing.T) {
	// We are relying on an undocumented feature of encoding/json where struct
	// fields are serialized into json with the same order that they are
	// defined in the struct. If this ever changes in the future, this test
	// helps us catch it.
	v1 := DefaultV1()
	buf := &bytes.Buffer{}
	err := v1.Encode(buf, false)
	require.NoError(t, err)
	const expectedJSON = `{"version":"v1","users":null,` +
		`"acls":{"/":{"whitelist_additional_permissions":null,` +
		`"anonymous_permissions":"read,list"}}}`
	require.Equal(t, expectedJSON, strings.TrimSpace(buf.String()))
}
