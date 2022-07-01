// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func generateBcryptPasswordHashForTestOrBust(t *testing.T, password string) string {
	passwordHash, err := bcrypt.GenerateFromPassword(
		[]byte(password), bcrypt.MinCost)
	require.NoError(t, err)
	return string(passwordHash)
}

func generateSHA256PasswordHashForTestOrBust(t *testing.T, password string) string {
	passwordHash, err := GenerateSHA256PasswordHash(password)
	require.NoError(t, err)
	return passwordHash
}

func stringPtr(str string) *string {
	return &str
}
