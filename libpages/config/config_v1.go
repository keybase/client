// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"encoding/json"
	"io"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

const (
	// PermRead is the read permission.
	PermRead = "read"
	// PermList is the list permission.
	PermList = "list"
	// PermReadAndList allows both read and list.
	PermReadAndList = "read,list"
)

// AccessControlV1 defines an access control list (ACL) for the V1 config.
type AccessControlV1 struct {
	// WhitelistAdditionalPermissions is a map of username -> permissions that
	// defines a list of additional permissions that authenticated users have
	// in addition to AnonymousPermissions.
	WhitelistAdditionalPermissions map[string]string `json:"whitelist_additional_permissions"`
	// AnonymousPermissions is the permissions for
	// unauthenticated/anonymous requests.
	AnonymousPermissions string `json:"anonymous_permissions"`
}

// V1 defines a V1 config. Public fields are accessible by `json`
// encoders and decoder.
//
// On first call to GetPermission* methods, it initializes an internal ACL
// checker. If the object is constructed from ParseConfig, its internal ACL
// checker is initialized automatically. Any changes to the ACL fields
// afterwards have no effect.
type V1 struct {
	Common

	// Users is a [username -> bcrypt-hashed password] map that defines how
	// users should be authenticated.
	Users map[string]string `json:"users"`

	// ACLs is a path -> AccessControlV1 map that defines ACLs for different
	// paths.
	ACLs map[string]AccessControlV1 `json:"acls"`

	initOnce          sync.Once
	aclChecker        *aclCheckerV1
	aclCheckerInitErr error
}

var _ Config = (*V1)(nil)

// DefaultV1 returns a default V1 config, which allows anonymous read to
// everything.
func DefaultV1() *V1 {
	v1 := &V1{
		Common: Common{
			Version: Version1Str,
		},
	}
	v1.EnsureInit()
	return v1
}

func (c *V1) initACLChecker() {
	c.aclChecker, c.aclCheckerInitErr = makeACLCheckerV1(c.ACLs, c.Users)
}

// EnsureInit initializes c, and returns any error encountered during the
// initialization. It is not necessary to call EnsureInit. Methods that need it
// does it automatically.
func (c *V1) EnsureInit() error {
	c.initOnce.Do(c.initACLChecker)
	return c.aclCheckerInitErr
}

// Version implements the Config interface.
func (c *V1) Version() Version {
	return Version1
}

// Authenticate implements the Config interface.
func (c *V1) Authenticate(username, password string) bool {
	passwordHash, ok := c.Users[username]
	if !ok {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) == nil
}

// GetPermissionsForAnonymous implements the Config interface.
func (c *V1) GetPermissionsForAnonymous(path string) (
	read, list bool, realm string, err error) {
	if err = c.EnsureInit(); err != nil {
		return false, false, "", err
	}

	perms, realm := c.aclChecker.getPermissions(path, nil)
	return perms.read, perms.list, realm, nil
}

// GetPermissionsForUsername implements the Config interface.
func (c *V1) GetPermissionsForUsername(path, username string) (
	read, list bool, realm string, err error) {
	if err = c.EnsureInit(); err != nil {
		return false, false, "", err
	}

	perms, realm := c.aclChecker.getPermissions(path, &username)
	return perms.read, perms.list, realm, nil
}

// Encode implements the Config interface.
func (c *V1) Encode(w io.Writer, prettify bool) error {
	encoder := json.NewEncoder(w)
	if prettify {
		encoder.SetIndent("", strings.Repeat(" ", 2))
	}
	return encoder.Encode(c)
}

// Validate checks all public fields of c, and returns an error if any of them
// is invalid, or a nil-error if they are all valid.
//
// Although changes to ACL fields have no effect to ACL checkings once the
// internal ACL checker is intialized (see comment on V1), this method still
// checks the updated ACL feilds. So it's OK to use Validate directly on a
// *V1 that has been modified since it was initialized.
//
// As a result, unlike other methods on the type, this method is not goroutine
// safe against changes to the public fields.
func (c *V1) Validate() error {
	_, err := makeACLCheckerV1(c.ACLs, c.Users)
	return err
}
