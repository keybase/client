// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"crypto/sha256"
	"encoding/hex"
)

// GenerateSHA256PasswordHash generates a sha256 hashed password hash from
// plaintextPassword in the form of "sha256:<hash>". This is what should go
// into the config file.
func GenerateSHA256PasswordHash(plaintextPassword string) string {
	hash := sha256.Sum256([]byte(plaintextPassword))
	return "sha256:" + hex.EncodeToString(hash[:])
}
