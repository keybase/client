// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"errors"
	"path"
	"strings"
)

type permissionsV1 struct {
	read bool
	list bool
}

type accessControlV1 struct {
	// username -> permissionsV1
	whitelistAdditional map[string]permissionsV1
	anonymous           permissionsV1
}

func parsePermissionsV1(permsStr string) (permissionsV1, error) {
	permsStr = strings.TrimSpace(permsStr)
	var perms permissionsV1
	if len(permsStr) == 0 {
		return perms, nil
	}
	for _, p := range strings.Split(permsStr, ",") {
		switch p {
		case PermRead:
			perms.read = true
		case PermList:
			perms.list = true
		default:
			return permissionsV1{}, ErrInvalidPermissions{
				permissions: permsStr}
		}
	}
	return perms, nil
}

func (a *AccessControlV1) makeAccessControlV1Internal(users map[string][]byte) (
	ac *accessControlV1, err error) {
	if a == nil {
		return nil, errors.New("nil AccessControlV1")
	}
	ac = &accessControlV1{}
	ac.anonymous, err = parsePermissionsV1(a.AnonymousPermissions)
	if err != nil {
		return nil, err
	}
	for username, permissions := range a.WhitelistAdditionalPermissions {
		if _, ok := users[username]; !ok {
			return nil, ErrUndefinedUsername{username: username}
		}
		if ac.whitelistAdditional == nil {
			ac.whitelistAdditional = make(map[string]permissionsV1)
		}
		ac.whitelistAdditional[username], err = parsePermissionsV1(permissions)
		if err != nil {
			return nil, err
		}
	}
	return ac, nil
}

func defaultAccessControlV1InternalForRoot() *accessControlV1 {
	return &accessControlV1{
		anonymous: permissionsV1{read: true, list: true},
	}
}

type aclCheckerV1 struct {
	children map[string]*aclCheckerV1
	ac       *accessControlV1
}

// cleanPath cleans p in following order:
//   1) Call path.Clean;
//   2) Remove leading and trailing "/";
//   3) Split the rest.
// If p is root, nil elems is returned. Otherwise, elems is guaranteed to
// be non-empty.
//
// If split2 is true, elems has at most 2 elements and the second one
// would include everything other than the first element in the path;
// otherwise, the entire p is split by "/" till the end of the world.
func cleanPath(p string, split2 bool) (elems []string) {
	p = path.Clean(p)
	if p == "/" || p == "." {
		// Examples of p (before clean) that lead us here:
		//   ""
		//   "/"
		//   "."
		//   "/.."
		//   "/."
		return nil
	}
	p = strings.Trim(p, "/")
	// Now p can only be form of "a/b/c", i.e., no leading or trailing
	// "/". Examples:
	//   "a"
	//   "a/b"
	//   "a/b/c"
	if split2 {
		return strings.SplitN(p, "/", 2)
	}
	return strings.Split(p, "/")
}

// getAccessControl gets the corresponding accessControlV1 for p.
// If a specifically defined one exists, it's returned. Otherwise the default
// one is returned.
func (c *aclCheckerV1) getAccessControl(
	parentAC *accessControlV1, p string) (ac *accessControlV1) {
	effectiveAC := c.ac
	if c.ac == nil {
		// If c.ac == nil, it means user didn't specify an ACL for this
		// directory. So just inherit from the parent.
		effectiveAC = parentAC
	}
	elems := cleanPath(p, true)
	if len(elems) == 0 || c.children == nil {
		return effectiveAC
	}
	if subChecker, ok := c.children[elems[0]]; ok {
		if len(elems) > 1 {
			return subChecker.getAccessControl(effectiveAC, elems[1])
		}
		return subChecker.getAccessControl(effectiveAC, ".")
	}

	return effectiveAC
}

func (c *aclCheckerV1) getPermissions(
	p string, username *string) (permissions permissionsV1) {
	// This is only called on the root aclCheckerV1, and c.ac is always
	// populated here.
	ac := c.getAccessControl(nil, p)
	permissions = ac.anonymous
	if ac.whitelistAdditional == nil || username == nil {
		return permissions
	}
	if perms, ok := ac.whitelistAdditional[*username]; ok {
		permissions.read = perms.read || permissions.read
		permissions.list = perms.list || permissions.list
	}
	return permissions
}

func makeACLCheckerV1(acl map[string]AccessControlV1,
	users map[string][]byte) (*aclCheckerV1, error) {
	root := &aclCheckerV1{ac: defaultAccessControlV1InternalForRoot()}
	if acl == nil {
		return root, nil
	}
	// path -> *AccessControlV1
	cleaned := make(map[string]*AccessControlV1)

	// Make sure there's no duplicate paths.
	for p := range acl {
		// We are doing a separate declaration here instead of in the for
		// statement above because we need to take the address of ac for each
		// element in acl, declarations in the for statement don't change
		// address.
		ac := acl[p]
		cleanedPath := path.Clean(p)
		if cleanedPath == "." {
			// Override "." with "/" since they both represent the site root.
			cleanedPath = "/"
		}
		if _, ok := cleaned[cleanedPath]; ok {
			return nil, ErrDuplicateAccessControlPath{cleanedPath: cleanedPath}
		}
		cleaned[cleanedPath] = &ac
	}

	for p, ac := range cleaned {
		ac, err := ac.makeAccessControlV1Internal(users)
		if err != nil {
			return nil, err
		}

		elems := cleanPath(p, false)
		if len(elems) == 0 {
			root.ac = ac
			continue
		}

		c := root
		// Construct aclCheckerV1 objects along the path and populate
		// defaultAC.
		for i := range elems {
			if c.children == nil {
				// path element -> *aclCheckerV1
				c.children = make(map[string]*aclCheckerV1)
			}
			if c.children[elems[i]] == nil {
				// Intentionally leave the ac field empty so if no ACL is
				// specified for this directory we'd use the one from its
				// parent (see getAccessControl).
				c.children[elems[i]] = &aclCheckerV1{}
			}
			c = c.children[elems[i]]
		}
		c.ac = ac
	}

	return root, nil
}
