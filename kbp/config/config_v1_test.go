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
	read, list, err := config.GetPermissionsForAnonymous("/")
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)
}

func TestConfigV1Invalid(t *testing.T) {
	_, _, err := (&V1{
		Common: Common{
			Version: Version1Str,
		},
		DefaultACL: AccessControlV1{
			WhitelistAdditionalPermissions: map[string]string{
				"alice": "read",
			},
		},
	}).GetPermissionsForAnonymous("/")
	require.Error(t, err)
	require.IsType(t, ErrUndefinedUsername{}, err)

	_, _, err = (&V1{
		Common: Common{
			Version: Version1Str,
		},
		ACLs: map[string]AccessControlV1{
			"/foo": AccessControlV1{
				AnonymousPermissions: "",
			},
			"/foo/../foo": AccessControlV1{
				AnonymousPermissions: "read",
			},
		},
	}).GetPermissionsForAnonymous("/")
	require.Error(t, err)
	require.IsType(t, ErrDuplicateAccessControlPath{}, err)

	_, _, err = (&V1{
		Common: Common{
			Version: Version1Str,
		},
		DefaultACL: AccessControlV1{
			AnonymousPermissions: "huh?",
		},
	}).GetPermissionsForAnonymous("/")
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
		Users: map[string][]byte{
			"alice": generatePasswordHashForTestOrBust(t, "12345"),
			"bob":   generatePasswordHashForTestOrBust(t, "54321"),
		},
		DefaultACL: AccessControlV1{
			AnonymousPermissions: "read",
		},
		ACLs: map[string]AccessControlV1{
			"/alice-and-bob": AccessControlV1{
				AnonymousPermissions: "",
				WhitelistAdditionalPermissions: map[string]string{
					"alice": "read,list",
					"bob":   "read",
				},
			},
			"/bob": AccessControlV1{
				AnonymousPermissions: "",
				WhitelistAdditionalPermissions: map[string]string{
					"bob": "read,list",
				},
			},
			"/public": AccessControlV1{
				AnonymousPermissions: "read,list",
			},
			"/public/not-really": AccessControlV1{
				AnonymousPermissions: "",
				WhitelistAdditionalPermissions: map[string]string{
					"alice": "read,list",
				},
			},
		},
	}

	read, list, err := config.GetPermissionsForAnonymous("/")
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)
	read, list, err = config.GetPermissionsForUsername("/", "alice")
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)
	read, list, err = config.GetPermissionsForUsername("/", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)

	read, list, err = config.GetPermissionsForAnonymous("/alice-and-bob")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	read, list, err = config.GetPermissionsForUsername("/alice-and-bob", "alice")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	read, list, err = config.GetPermissionsForUsername("/alice-and-bob", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.False(t, list)

	read, list, err = config.GetPermissionsForAnonymous("/bob")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	read, list, err = config.GetPermissionsForUsername("/bob", "alice")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	read, list, err = config.GetPermissionsForUsername("/bob", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)

	read, list, err = config.GetPermissionsForAnonymous("/public")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	read, list, err = config.GetPermissionsForUsername("/public", "alice")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	read, list, err = config.GetPermissionsForUsername("/public", "bob")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)

	read, list, err = config.GetPermissionsForAnonymous("/public/not-really")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
	read, list, err = config.GetPermissionsForUsername("/public/not-really", "alice")
	require.NoError(t, err)
	require.True(t, read)
	require.True(t, list)
	read, list, err = config.GetPermissionsForUsername("/public/not-really", "bob")
	require.NoError(t, err)
	require.False(t, read)
	require.False(t, list)
}
