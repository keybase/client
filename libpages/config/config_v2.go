// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"strings"
	"sync"
)

// V2 defines a V2 config. Public fields are accessible by `json`
// encoders and decoder.
//
// On first call to GetPermission* methods, it initializes an internal ACL
// checker. If the object is constructed from ParseConfig, its internal ACL
// checker is initialized automatically. Any changes to the ACL fields
// afterwards have no effect.
type V2 struct {
	Common

	// Users is a [username -> sha256-hashed password in form of
	// "sha256:<hex>"] map that defines how users should be authenticated.
	Users map[string]string `json:"users"`

	// username -> sha256 hash
	users map[string][]byte `json:"users"`

	// ACLs is a path -> AccessControlV1 map that defines ACLs for different
	// paths.
	ACLs map[string]AccessControlV1 `json:"acls"`

	initOnce   sync.Once
	aclChecker *aclCheckerV1
	initErr    error
}

var _ Config = (*V2)(nil)

// DefaultV2 returns a default V2 config, which allows anonymous read to
// everything.
func DefaultV2() *V2 {
	v2 := &V2{
		Common: Common{
			Version: Version2Str,
		},
		ACLs: map[string]AccessControlV1{
			"/": AccessControlV1{
				AnonymousPermissions: "read,list",
			},
		},
	}
	v2.EnsureInit()
	return v2
}

// InvalidPasswordHash is the error that happens when there's an invalid
// password hash in the config.
type InvalidPasswordHash struct{}

// Error implements the error interface.
func (InvalidPasswordHash) Error() string {
	return "invalid passwordhash"
}

const sha256PasswordHashPrefix = "sha256:"

func (c *V2) init() {
	c.aclChecker, c.initErr = makeACLCheckerV1(c.ACLs, c.Users)
	if c.initErr != nil {
		return
	}
	c.users = make(map[string][]byte)
	for username, pass := range c.Users {
		if !strings.HasPrefix(pass, sha256PasswordHashPrefix) {
			c.initErr = InvalidPasswordHash{}
			return
		}
		if len(pass) != hex.EncodedLen(sha256.Size)+len(sha256PasswordHashPrefix) {
			c.initErr = InvalidPasswordHash{}
			return
		}
		c.users[username], c.initErr = hex.DecodeString(pass[len(sha256PasswordHashPrefix):])
		if c.initErr != nil {
			return
		}
	}
}

// EnsureInit initializes c, and returns any error encountered during the
// initialization. It is not necessary to call EnsureInit. Methods that need it
// does it automatically.
func (c *V2) EnsureInit() error {
	c.initOnce.Do(c.init)
	if c.initErr != nil {
		return c.initErr
	}
	return nil
}

// Version implements the Config interface.
func (c *V2) Version() Version {
	return Version2
}

// Authenticate implements the Config interface.
func (c *V2) Authenticate(ctx context.Context, username, cleartextPassword string) bool {
	if c.EnsureInit() != nil {
		return false
	}

	passwordHash, ok := c.users[username]
	if !ok {
		return false
	}

	clearSum := sha256.Sum256([]byte(cleartextPassword))
	return bytes.Equal(clearSum[:], passwordHash)
}

// GetPermissions implements the Config interface.
func (c *V2) GetPermissions(path string, username *string) (
	read, list bool,
	possibleRead, possibleList bool,
	realm string, err error) {
	if err = c.EnsureInit(); err != nil {
		return false, false, false, false, "", err
	}

	perms, maxPerms, realm := c.aclChecker.getPermissions(path, username)
	return perms.read, perms.list, maxPerms.read, maxPerms.list, realm, nil
}

// Encode implements the Config interface.
func (c *V2) Encode(w io.Writer, prettify bool) error {
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
// internal ACL checker is intialized (see comment on V2), this method still
// checks the updated ACL feilds. So it's OK to use Validate directly on a
// *V2 that has been modified since it was initialized.
//
// As a result, unlike other methods on the type, this method is not goroutine
// safe against changes to the public fields.
func (c *V2) Validate() error {
	_, err := makeACLCheckerV1(c.ACLs, c.Users)
	return err
}
