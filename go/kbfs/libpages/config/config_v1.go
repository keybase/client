// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"context"
	"encoding/json"
	"io"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

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

	users map[string]password

	bcryptLimiter *rate.Limiter

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
		ACLs: map[string]AccessControlV1{
			"/": {
				AnonymousPermissions: "read,list",
			},
		},
	}
	_ = v1.EnsureInit() // TODO: check error?
	return v1
}

const bcryptRateLimitInterval = time.Second / 2

func (c *V1) init() {
	c.bcryptLimiter = rate.NewLimiter(rate.Every(bcryptRateLimitInterval), 1)
	c.aclChecker, c.aclCheckerInitErr = makeACLCheckerV1(c.ACLs, c.Users)
	if c.aclCheckerInitErr != nil {
		return
	}
	c.users = make(map[string]password)
	for username, passwordHash := range c.Users {
		c.users[username], c.aclCheckerInitErr = newPassword(passwordHash)
		if c.aclCheckerInitErr != nil {
			return
		}
	}
}

// EnsureInit initializes c, and returns any error encountered during the
// initialization. It is not necessary to call EnsureInit. Methods that need it
// does it automatically.
func (c *V1) EnsureInit() error {
	c.initOnce.Do(c.init)
	return c.aclCheckerInitErr
}

// Version implements the Config interface.
func (c *V1) Version() Version {
	return Version1
}

// Authenticate implements the Config interface.
func (c *V1) Authenticate(ctx context.Context, username, cleartextPassword string) bool {
	if c.EnsureInit() != nil {
		return false
	}

	p, ok := c.users[username]
	if !ok {
		return false
	}
	match, err := p.check(ctx, c.bcryptLimiter, cleartextPassword)
	return err == nil && match
}

// GetPermissions implements the Config interface.
func (c *V1) GetPermissions(path string, username *string) (
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

// HasBcryptPasswords checks if any password hash in the config is a bcrypt
// hash. This method is temporary for migration and will go away.
func (c *V1) HasBcryptPasswords() (bool, error) {
	if err := c.EnsureInit(); err != nil {
		return false, err
	}
	for _, pass := range c.users {
		if pass.passwordType() == passwordTypeBcrypt {
			return true, nil
		}
	}
	return false, nil
}
