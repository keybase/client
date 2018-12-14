// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

const (
	// ServerTokenServer is the expected server type for mdserver authentication.
	ServerTokenServer = "kbfs_md"
	// ServerTokenExpireIn is the TTL to use when constructing an authentication token.
	ServerTokenExpireIn = 24 * 60 * 60 // 24 hours
)
