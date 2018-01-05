// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestConfigV1Default(t *testing.T) {
	config := DefaultV1()
	read, list, realm, err := config.GetPermissionsForAnonymous("/")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/", realm)
}

func TestConfigV1Invalid(t *testing.T) {
	err := (&V1{
		Common: Common{
			Version: Version1Str,
		},
		ACLs: map[string]AccessControlV1{
			"/": AccessControlV1{
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
			"/": AccessControlV1{
				AnonymousPermissions: "",
			},
			"": AccessControlV1{
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
			"/foo": AccessControlV1{
				AnonymousPermissions: "",
			},
			"/foo/../foo": AccessControlV1{
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
			"/": AccessControlV1{
				AnonymousPermissions: "huh?",
			},
		},
	}).EnsureInit()
	require.Error(t, err)
	require.IsType(t, ErrInvalidPermissions{}, err)
}

func generatePasswordHashForTestOrBust(t *testing.T, password string) []byte {
	passwordHash, err := bcrypt.GenerateFromPassword(
		[]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)
	return passwordHash
}

func TestConfigV1Full(t *testing.T) {
	config := V1{
		Common: Common{
			Version: Version1Str,
		},
		Users: map[string]string{
			"alice": string(generatePasswordHashForTestOrBust(t, "12345")),
			"bob":   string(generatePasswordHashForTestOrBust(t, "54321")),
		},
		ACLs: map[string]AccessControlV1{
			"/": AccessControlV1{
				AnonymousPermissions: "read,list",
			},
			"/alice-and-bob": AccessControlV1{
				WhitelistAdditionalPermissions: map[string]string{
					"alice": PermReadAndList,
					"bob":   PermRead,
				},
			},
			"/bob": AccessControlV1{
				AnonymousPermissions: "",
				WhitelistAdditionalPermissions: map[string]string{
					"bob": PermReadAndList,
				},
			},
			"/public": AccessControlV1{
				AnonymousPermissions: PermReadAndList,
			},
			"/public/not-really": AccessControlV1{
				AnonymousPermissions: "",
				WhitelistAdditionalPermissions: map[string]string{
					"alice": PermReadAndList,
				},
			},
			"/bob/dir/deep-dir/deep-deep-dir": AccessControlV1{},
		},
	}

	authenticated := config.Authenticate("alice", "12345")
	require.True(t, authenticated)

	read, list, realm, err := config.GetPermissionsForAnonymous("/")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/", "alice")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/", realm)

	read, list, realm, err = config.GetPermissionsForAnonymous("/alice-and-bob")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/alice-and-bob", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/alice-and-bob", "alice")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/alice-and-bob", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/alice-and-bob", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)
	require.Equal(t, "/alice-and-bob", realm)

	read, list, realm, err = config.GetPermissionsForAnonymous("/bob")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/bob", "alice")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/bob", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/bob", realm)

	read, list, realm, err = config.GetPermissionsForAnonymous("/public")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/public", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/public", "alice")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/public", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/public", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/public", realm)

	read, list, realm, err = config.GetPermissionsForAnonymous("/public/not-really")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/public/not-really", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/public/not-really", "alice")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/public/not-really", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/public/not-really", "bob")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/public/not-really", realm)

	read, list, realm, err = config.GetPermissionsForAnonymous("/bob/dir")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/bob/dir", "alice")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/bob/dir", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/bob", realm)

	read, list, realm, err = config.GetPermissionsForAnonymous("/bob/dir/sub")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/bob/dir/sub", "alice")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/bob/dir/sub", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	require.Equal(t, "/bob", realm)

	read, list, realm, err = config.GetPermissionsForAnonymous("/bob/dir/deep-dir/deep-deep-dir")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob/dir/deep-dir/deep-deep-dir", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/bob/dir/deep-dir/deep-deep-dir", "alice")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob/dir/deep-dir/deep-deep-dir", realm)
	read, list, realm, err = config.GetPermissionsForUsername("/bob/dir/deep-dir/deep-deep-dir", "bob")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	require.Equal(t, "/bob/dir/deep-dir/deep-deep-dir", realm)
}
