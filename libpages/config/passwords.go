// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

type passwordType int

const (
	_ passwordType = iota
	passwordTypeBcrypt
	passwordTypeSHA256
)

const sha256PasswordHashPrefix = "sha256:"

// InvalidPasswordHash is the error that happens when there's an invalid
// password hash in the config.
type InvalidPasswordHash struct{}

// Error implements the error interface.
func (InvalidPasswordHash) Error() string {
	return "invalid passwordhash"
}

type password interface {
	check(ctx context.Context,
		limiter *rate.Limiter, cleartext string) (bool, error)
	hash() string
	passwordType() passwordType
}

type sha256Password struct {
	sha256Hash [sha256.Size]byte
}

var _ password = (*sha256Password)(nil)

func (p *sha256Password) check(
	_ context.Context, _ *rate.Limiter, cleartext string) (bool, error) {
	return p.sha256Hash == sha256.Sum256([]byte(cleartext)), nil
}

func (p *sha256Password) hash() string {
	return hex.EncodeToString(p.sha256Hash[:])
}

func (p *sha256Password) passwordType() passwordType {
	return passwordTypeSHA256
}

type bcryptCachingPassword struct {
	bcryptHash []byte

	lock      sync.RWMutex
	cleartext string
}

var _ password = (*bcryptCachingPassword)(nil)

func (p *bcryptCachingPassword) getCachedCleartext() string {
	p.lock.RLock()
	defer p.lock.RUnlock()
	return p.cleartext
}

func (p *bcryptCachingPassword) setCachedCleartext(cleartext string) {
	p.lock.Lock()
	defer p.lock.Unlock()
	p.cleartext = cleartext
}

func (p *bcryptCachingPassword) passwordType() passwordType {
	return passwordTypeBcrypt
}

func (p *bcryptCachingPassword) check(ctx context.Context,
	limiter *rate.Limiter, cleartext string) (bool, error) {
	cachedCleartext := p.getCachedCleartext()
	if len(cachedCleartext) > 0 {
		return cachedCleartext == cleartext, nil
	}

	if err := limiter.Wait(ctx); err != nil {
		return false, err
	}

	match := bcrypt.CompareHashAndPassword(
		p.bcryptHash, []byte(cleartext)) == nil
	if match {
		p.setCachedCleartext(cleartext)
	}

	return match, nil
}

func (p *bcryptCachingPassword) hash() string { return string(p.bcryptHash) }

// GenerateSHA256PasswordHash generates a SHA256 based password hash.
func GenerateSHA256PasswordHash(cleartext string) string {
	hash := sha256.Sum256([]byte(cleartext))
	return sha256PasswordHashPrefix + hex.EncodeToString(hash[:])
}

// newPassword takes a password hash (usually from a .kbp_config file) and
// makes a password object out of it. Accepted password hashes are:
//   1. bcrypt hashes. For example:
//       $2a$04$DXabUWtVUX/nOEQ2R8aBT.wRUZxllKA2Lbm6Z3cGhkRLwMb6u8Esq
//   2. sha256 hashes. For example:
//       sha256:20f3765880a5c269b747e1e906054a4b4a3a991259f1e16b5dde4742cec2319a
func newPassword(passwordHashFromConfig string) (password, error) {
	if strings.HasPrefix(passwordHashFromConfig, sha256PasswordHashPrefix) {
		if len(passwordHashFromConfig) !=
			hex.EncodedLen(sha256.Size)+len(sha256PasswordHashPrefix) {
			return nil, InvalidPasswordHash{}
		}
		b, err := hex.DecodeString(
			passwordHashFromConfig[len(sha256PasswordHashPrefix):])
		if err != nil {
			return nil, InvalidPasswordHash{}
		}
		p := &sha256Password{}
		copy(p.sha256Hash[:], b)
		return p, nil
	}
	if _, err := bcrypt.Cost([]byte(passwordHashFromConfig)); err == nil {
		return &bcryptCachingPassword{
			bcryptHash: []byte(passwordHashFromConfig),
		}, nil
	}
	return nil, InvalidPasswordHash{}
}
