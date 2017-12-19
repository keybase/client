// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"crypto/sha512"
	"encoding/hex"
	"sync"
)

// MakeSaltedSHA512PasswordHex takes concatenated salt and password, calculate
// SHA512 of it, and return the result encoded in hex.
func MakeSaltedSHA512PasswordHex(password string, salt string) string {
	s := sha512.Sum512([]byte(salt + password))
	return hex.EncodeToString(s[:])
}

// UserV1 defines a user's hashed password for the V1 config.
type UserV1 struct {
	PasswordSHA512Hex string `json:"password_sha512_hex"`
	PasswordSalt      string `json:"password_salt"`
}

// Authenticate returns true if password matches u, or false if not.
func (u *UserV1) Authenticate(password string) bool {
	return MakeSaltedSHA512PasswordHex(
		password, u.PasswordSalt) == u.PasswordSHA512Hex
}

// AccessControlV1 defines an access control list (ACL) for the V1 config.
type AccessControlV1 struct {
	// WhitelistAdditionalPermissions is a map of username -> permissions that
	// defines a list of additional permissions that authenticated users have
	// in addition to AnonymousPermissions
	WhitelistAdditionalPermissions map[string]string `json:"whitelist_additional_permissions"`
	// AnonymousPermissions is the permissions for
	// unauthenticated/anonymous requests.
	AnonymousPermissions string `json:"anonymous_permissions"`
}

// V1 defines a V1 config. Public fields are accessible by `json`
// encoders and decoder. On first call to GetPermission* methods, it
// initializes an internal ACL checker. Any changes to the ACL fields
// afterwards have no effect.
type V1 struct {
	Common

	// Users is a username -> UserV1 map that defines how users should be
	// authenticated.
	Users map[string]UserV1 `json:"users"`

	// DefaultACL defines the ACL that should be used for paths that no ACL has
	// been configured for.
	DefaultACL AccessControlV1 `json:"default_acl"`
	// ACLs is a path -> AccessControlV1 map that defines ACLs for different
	// paths.
	ACLs map[string]AccessControlV1 `json:"acls"`

	initOnce          sync.Once
	aclChecker        *aclCheckerV1
	aclCheckerInitErr error
}

// DefaultV1 returns a default V1 config, which allows anonymous read to
// everything.
func DefaultV1() *V1 {
	return &V1{
		Common: Common{
			Version: Version1Str,
		},
		DefaultACL: AccessControlV1{
			AnonymousPermissions: "read",
		},
	}
}

// Version implements the Config interface.
func (c *V1) Version() Version {
	return Version1
}

// Authenticate implements the Config interface.
func (c *V1) Authenticate(username, password string) bool {
	u, ok := c.Users[username]
	if !ok {
		return false
	}
	return u.Authenticate(password)
}

func (c *V1) initACLChecker() {
	c.aclChecker, c.aclCheckerInitErr = makeACLCheckerV1(c.DefaultACL, c.ACLs, c.Users)
}

// GetPermissionsForAnonymous implements the Config interface.
func (c *V1) GetPermissionsForAnonymous(thePath string) (
	read, list bool, err error) {
	c.initOnce.Do(c.initACLChecker)
	if c.aclCheckerInitErr != nil {
		return false, false, c.aclCheckerInitErr
	}

	perms := c.aclChecker.getPermissions(thePath, nil)
	return perms.read, perms.list, nil
}

// GetPermissionsForUsername implements the Config interface.
func (c *V1) GetPermissionsForUsername(thePath, username string) (
	read, list bool, err error) {
	c.initOnce.Do(c.initACLChecker)
	if c.aclCheckerInitErr != nil {
		return false, false, c.aclCheckerInitErr
	}

	perms := c.aclChecker.getPermissions(thePath, &username)
	return perms.read, perms.list, nil
}
