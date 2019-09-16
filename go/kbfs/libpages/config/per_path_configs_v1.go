// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"errors"
	"path"
	"strings"
)

const (
	// PermRead is the read permission.
	PermRead = "read"
	// PermList is the list permission.
	PermList = "list"
	// PermReadAndList allows both read and list.
	PermReadAndList = "read,list"
)

// PerPathConfigV1 defines a per-path configuration structure, including an
// access control list (ACL) for the V1 config.
type PerPathConfigV1 struct {
	// WhitelistAdditionalPermissions is a map of username -> permissions that
	// defines a list of additional permissions that authenticated users have
	// in addition to AnonymousPermissions.
	WhitelistAdditionalPermissions map[string]string `json:"whitelist_additional_permissions"`
	// AnonymousPermissions is the permissions for
	// unauthenticated/anonymous requests.
	AnonymousPermissions string `json:"anonymous_permissions"`

	// AccessControlAllowOrigin, if set, causes the setting of the
	// Access-Control-Allow-Origin header when serving requests under the
	// corresponding path.
	AccessControlAllowOrigin string `json:"Access-Control-Allow-Origin,omitempty"`
	// Custom403Forbidden specifies a path (relative to site root) to a html
	// file to be served when 403 errors happen.
	Custom403Forbidden string `json:"custom_403_forbidden,omitempty"`
	// Custom404NotFound specifies a path (relative to site root) to a html
	// file to be served when 404 errors happen.
	Custom404NotFound string `json:"custom_404_not_found,omitempty"`
}

// permissionsV1 is the parsed version of a permission string.
type permissionsV1 struct {
	read bool
	list bool
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

// perPathConfigV1 is the parsed version of PerPathConfigV1. It can be used
// directly with no parsing errors by the perPathConfigsReaderV1.
type perPathConfigV1 struct {
	// whitelistAdditional is the internal version of
	// PerPathConfigV1.WhitelistAdditionalPermissions. See comment of latter
	// for more details. It's a map of username -> permissionsV1.
	whitelistAdditional map[string]permissionsV1
	anonymous           permissionsV1
	// maxPermission stores the most permissive permission that either an
	// anonymous or an authenticated user can get for this path. Note that this
	// doesn't necessarily mean there's a user able to get exactly this
	// permission, since it's possible to have a user with `read` and a user
	// with `list`, causing maxPermission to be {read: true, list: true} but
	// never a user getting both.
	maxPermission permissionsV1
	// p stores the path (from Config declaration) that an *perPathConfigV1
	// object is constructed for. When an *perPathConfigsReaderV1 is picked for a path,
	// the p field can be used as a realm for HTTP Basic Authentication.
	p string

	accessControlAllowOrigin string
	custom403Forbidden       string
	custom404NotFound        string
}

func checkCors(acao string) (cleaned string, err error) {
	cleaned = strings.TrimSpace(acao)
	if cleaned != "" && cleaned != "*" {
		// TODO: support setting non-wildcard origins. Note that none wildcard
		// ones need a Vary header too.
		return "", ErrInvalidConfig{msg: "only \"*\" is supported as " +
			"non-empty Access-Control-Allow-Origin for now"}
	}
	return cleaned, nil
}

func checkCustomPagePath(p string) (cleaned string, err error) {
	if len(p) == 0 {
		return "", nil
	}
	cleaned = path.Clean(p)
	if strings.HasPrefix(cleaned, "..") {
		return "", ErrInvalidConfig{"invalid custom page path: " + p}
	}
	return cleaned, nil
}

// makePerPathConfigV1Internal makes an *perPathConfigV1 out of an
// *PerPathConfigV1. The users map is used to check if every username defined
// in WhitelistAdditionalPermissions is defined.
func makePerPathConfigV1Internal(
	a *PerPathConfigV1, users map[string]string, p string) (
	ac *perPathConfigV1, err error) {
	if a == nil {
		return nil, errors.New("nil PerPathConfigV1")
	}
	ac = &perPathConfigV1{p: p}
	ac.anonymous, err = parsePermissionsV1(a.AnonymousPermissions)
	if err != nil {
		return nil, err
	}
	ac.maxPermission = ac.anonymous
	for username, permissions := range a.WhitelistAdditionalPermissions {
		if _, ok := users[username]; !ok {
			return nil, ErrUndefinedUsername{username: username}
		}
		if ac.whitelistAdditional == nil {
			ac.whitelistAdditional = make(map[string]permissionsV1)
		}
		parsedPermissions, err := parsePermissionsV1(permissions)
		if err != nil {
			return nil, err
		}
		ac.whitelistAdditional[username] = parsedPermissions
		ac.maxPermission.read = ac.maxPermission.read || parsedPermissions.read
		ac.maxPermission.list = ac.maxPermission.list || parsedPermissions.list
	}

	if ac.accessControlAllowOrigin, err = checkCors(
		a.AccessControlAllowOrigin); err != nil {
		return nil, err
	}
	if ac.custom403Forbidden, err = checkCustomPagePath(
		a.Custom403Forbidden); err != nil {
		return nil, err
	}
	if ac.custom404NotFound, err = checkCustomPagePath(
		a.Custom404NotFound); err != nil {
		return nil, err
	}

	return ac, nil
}

func emptyPerPathConfigV1InternalForRoot() *perPathConfigV1 {
	return &perPathConfigV1{
		anonymous: permissionsV1{}, // no permission
		p:         "/",
	}
}

type perPathConfigsReaderV1 struct {
	children map[string]*perPathConfigsReaderV1
	// ac, if not nil, defines the access control that should be applied to the
	// path that the *perPathConfigsReaderV1 represents. If it's nil, it means no
	// specific access control is defined for the path, and the object exists
	// most likely for the purpose of the children field to realy to checkers
	// under this path. In this case, the parent's access control is the
	// effective one for this path.
	ac *perPathConfigV1
}

// cleanPath cleans p in by first calling path.Clean, then removing any leading
// and trailing "/".
//
// If p represents root, an empty string is returned.
//
// Use cleanPathAndSplit2 or cleanPathAndSplit to further split the path.
func cleanPath(p string) string {
	p = path.Clean(p)
	if p == "/" || p == "." {
		// Examples of p (before clean) that lead us here:
		//   ""
		//   "/"
		//   "."
		//   "/.."
		//   "/."
		return ""
	}
	// After the trim, p can only be form of "a/b/c", i.e., no leading or
	// trailing "/". Examples:
	//   "a"
	//   "a/b"
	//   "a/b/c"
	return strings.Trim(p, "/")
}

// cleanPathAndSplit calls cleanPath on p and splits the result using separator
// "/", into a slice consisting of at least 1 element.
func cleanPathAndSplit(p string) (elems []string) {
	return strings.Split(cleanPath(p), "/")
}

// cleanPathAndSplit2 calls cleanPath on p and splits the result using
// separator "/", into a slice of either 1 or 2 elements.
func cleanPathAndSplit2(p string) (elems []string) {
	return strings.SplitN(cleanPath(p), "/", 2)
}

// getPerPathConfig gets the corresponding perPathConfigV1 for p. It walks
// along the children field recursively.  If a specifically defined one exists,
// it's returned. Otherwise the parent's (parentAC) is returned.
func (c *perPathConfigsReaderV1) getPerPathConfig(
	parentAC *perPathConfigV1, p string) (ac *perPathConfigV1) {
	effectiveAC := c.ac
	if c.ac == nil {
		// If c.ac == nil, it means user didn't specify a config for the
		// path that c represents. So just inherit from the parent.
		effectiveAC = parentAC
	}
	elems := cleanPathAndSplit2(p)
	if len(elems[0]) == 0 || c.children == nil {
		// Either what we are looking for is exactly what c represents, or c
		// doesn't have any children *perPathConfigsReaderV1's. Either way, c should be
		// the checker that controls the path p, so we can just returned the
		// current effectiveAC.
		return effectiveAC
	}
	// See if we have a sub-checker for the next element in the path p.
	if subChecker, ok := c.children[elems[0]]; ok {
		if len(elems) > 1 {
			// There are more elements in the path p, so ask the sub-checker
			// for check for the rest.
			return subChecker.getPerPathConfig(effectiveAC, elems[1])
		}
		// The sub-checker is what we need in order to know get the
		// *perPathConfigV1 for path p, so call it with "." to indicate that.
		return subChecker.getPerPathConfig(effectiveAC, ".")
	}

	// We don't have a sub-checker for the next element in the path p, so just
	// use the current effectiveAC like the `len(elems[0]) == 0 || c.children
	// == nil` above.
	return effectiveAC
}

// getPermissions returns the permissions that username has on p. This method
// should only be called on the root perPathConfigsReaderV1.
func (c *perPathConfigsReaderV1) getPermissions(p string, username *string) (
	permissions permissionsV1, max permissionsV1, effectivePath string) {
	// This is only called on the root perPathConfigsReaderV1, and c.ac is always
	// populated here. So even if no other path shows up in the per-path
	// configs, any path will get root's *perPathConfigV1 as the last resort.
	ac := c.getPerPathConfig(nil, p)
	permissions = ac.anonymous
	if ac.whitelistAdditional == nil || username == nil {
		return permissions, ac.maxPermission, ac.p
	}
	if perms, ok := ac.whitelistAdditional[*username]; ok {
		permissions.read = perms.read || permissions.read
		permissions.list = perms.list || permissions.list
	}
	return permissions, ac.maxPermission, ac.p
}

func (c *perPathConfigsReaderV1) getSetAccessControlAllowOrigin(p string) (setting string) {
	ac := c.getPerPathConfig(nil, p)
	return ac.accessControlAllowOrigin
}

// makePerPathConfigsReaderV1 makes an *perPathConfigsReaderV1 out of
// user-defined per-path configs. It recursively constructs nested
// *perPathConfigsReaderV1 so that each defined path has a corresponding
// checker, and all intermediate nodes have a checker populated.
func makePerPathConfigsReaderV1(configs map[string]PerPathConfigV1,
	users map[string]string) (*perPathConfigsReaderV1, error) {
	root := &perPathConfigsReaderV1{ac: emptyPerPathConfigV1InternalForRoot()}
	if configs == nil {
		return root, nil
	}
	// path -> *PerPathConfigV1
	cleaned := make(map[string]*PerPathConfigV1)

	// Make sure there's no duplicate paths.
	for p := range configs {
		// We are doing a separate declaration here instead of in the for
		// statement above because we need to take the address of ac for each
		// element in configs, declarations in the for statement don't change
		// address.
		ac := configs[p]
		cleanedPath := path.Clean(p)
		if cleanedPath == "." {
			// Override "." with "/" since they both represent the site root.
			cleanedPath = "/"
		}
		if _, ok := cleaned[cleanedPath]; ok {
			return nil, ErrDuplicatePerPathConfigPath{cleanedPath: cleanedPath}
		}
		cleaned[cleanedPath] = &ac
	}

	// Iterate through the cleaned slice, and construct *perPathConfigsReaderV1 objects
	// along each path.
	for p, a := range cleaned {
		ac, err := makePerPathConfigV1Internal(a, users, p)
		if err != nil {
			return nil, err
		}

		elems := cleanPathAndSplit(p)
		if len(elems[0]) == 0 {
			root.ac = ac
			continue
		}

		c := root
		// Construct perPathConfigsReaderV1 objects along the path if needed.
		for _, elem := range elems {
			if c.children == nil {
				// path element -> *perPathConfigsReaderV1
				c.children = make(map[string]*perPathConfigsReaderV1)
			}
			if c.children[elem] == nil {
				// Intentionally leave the ac field empty so if no config is
				// specified for this directory we'd use the one from its
				// parent (see getPerPathConfig).
				c.children[elem] = &perPathConfigsReaderV1{}
			}
			c = c.children[elem]
		}
		// Now that c points the the *perPathConfigsReaderV1 that represents the path p,
		// populate c.ac for it.
		c.ac = ac
	}

	return root, nil
}
