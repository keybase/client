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

// username -> permissionsV1
type accessControlV1 struct {
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
		case "read":
			perms.read = true
		case "list":
			perms.list = true
		default:
			return permissionsV1{}, ErrInvalidPermissions{
				permissions: permsStr}
		}
	}
	return perms, nil
}

func (ac *AccessControlV1) makeAccessControlV1Internal(users map[string][]byte) (
	aci *accessControlV1, err error) {
	if ac == nil {
		return nil, errors.New("nil AccessControlV1")
	}
	aci = &accessControlV1{}
	aci.anonymous, err = parsePermissionsV1(ac.AnonymousPermissions)
	if err != nil {
		return nil, err
	}
	for username, permissions := range ac.WhitelistAdditionalPermissions {
		if _, ok := users[username]; !ok {
			return nil, ErrUndefinedUsername{username: username}
		}
		if aci.whitelistAdditional == nil {
			aci.whitelistAdditional = make(map[string]permissionsV1)
		}
		aci.whitelistAdditional[username], err = parsePermissionsV1(permissions)
		if err != nil {
			return nil, err
		}
	}
	return aci, nil
}

type aclCheckerV1 struct {
	children map[string]*aclCheckerV1
	aci      *accessControlV1
}

// cleanPath cleans thePath in following order:
//   1) Call path.Clean;
//   2) Remove leading and trailing "/";
//   3) Split the rest.
// If thePath is root, nil elems is returned. Otherwise, elems is guaranteed to
// be non-empty.
//
// If split2 is true, at most elems has at most 2 elements and the second one
// would include everything other than the first element in the path;
// otherwise, the entire thePath is split by "/" till the end of the world.
func cleanPath(thePath string, split2 bool) (elems []string) {
	thePath = path.Clean(thePath)
	if thePath == "/" || thePath == "." {
		// Examples of thePath (before clean) that lead us here:
		//   ""
		//   "/"
		//   "."
		//   "/.."
		//   "/."
		return nil
	}
	if strings.HasPrefix(thePath, "/") {
		thePath = thePath[1:]
	}
	if strings.HasSuffix(thePath, "/") {
		thePath = thePath[:len(thePath)-1]
	}
	// Now thePath can only be form of "a/b/c", i.e., no leading or trailing
	// "/". Examples:
	//   "a"
	//   "a/b"
	//   "a/b/c"
	if split2 {
		return strings.SplitN(thePath, "/", 2)
	}
	return strings.Split(thePath, "/")
}

// getAccessControl gets the corresponding accessControlV1 for thePath.
// If a specifically defined exists, it's returned. Otherwise the default one
// is returned.
func (m *aclCheckerV1) getAccessControl(thePath string) (aci *accessControlV1) {
	elems := cleanPath(thePath, true)
	if elems == nil || m.children == nil {
		return m.aci
	}
	// elems can't be empty.
	if subChecker, ok := m.children[elems[0]]; ok {
		if len(elems) > 1 {
			return subChecker.getAccessControl(elems[1])
		}
		return subChecker.getAccessControl(".")
	}

	return m.aci
}

func (m *aclCheckerV1) getPermissions(
	thePath string, username *string) (permissions permissionsV1) {
	aci := m.getAccessControl(thePath)
	permissions = aci.anonymous
	if aci.whitelistAdditional == nil || username == nil {
		return permissions
	}
	if perms, ok := aci.whitelistAdditional[*username]; ok {
		permissions.read = perms.read || permissions.read
		permissions.list = perms.list || permissions.list
	}
	return permissions
}

func makeACLCheckerV1(defaultAC AccessControlV1, acl map[string]AccessControlV1,
	users map[string][]byte) (*aclCheckerV1, error) {
	defaultACI, err := defaultAC.makeAccessControlV1Internal(users)
	if err != nil {
		return nil, err
	}
	root := &aclCheckerV1{aci: defaultACI}
	if acl == nil {
		return root, nil
	}
	// path -> *AccessControlV1
	cleaned := make(map[string]*AccessControlV1)

	// Make sure there's no duplicate paths.
	for p := range acl {
		ac := acl[p]
		cleanedPath := path.Clean(p)
		if _, ok := cleaned[cleanedPath]; ok {
			return nil, ErrDuplicateAccessControlPath{cleanedPath: cleanedPath}
		}
		cleaned[cleanedPath] = &ac
	}

	for p, ac := range cleaned {
		aci, err := ac.makeAccessControlV1Internal(users)
		if err != nil {
			return nil, err
		}

		elems := cleanPath(p, false)
		if elems == nil {
			root.aci = aci
			continue
		}

		m := root
		// Construct aclCheckerV1 objects along the path and populate
		// defaultACI.
		for i := range elems {
			if m.children == nil {
				// path element -> *aclCheckerV1
				m.children = make(map[string]*aclCheckerV1)
			}
			if m.children[elems[i]] == nil {
				m.children[elems[i]] = &aclCheckerV1{aci: defaultACI}
			}
			m = m.children[elems[i]]
		}
		m.aci = aci
	}

	return root, nil
}
