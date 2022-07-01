// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
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

const passwordHashDivider = ":"
const sha256PasswordHashPrefix = "sha256"
const saltSize = 12

var sha256PasswordHashLength = len(sha256PasswordHashPrefix) +
	len(passwordHashDivider) +
	hex.EncodedLen(saltSize) +
	len(passwordHashDivider) +
	hex.EncodedLen(sha256.Size)
var sha256PasswordHashSaltIndex = len(sha256PasswordHashPrefix) +
	len(passwordHashDivider)
var sha256PasswordHashSaltEnd = sha256PasswordHashSaltIndex +
	hex.EncodedLen(saltSize)
var sha256PasswordHashSHA256Index = sha256PasswordHashSaltEnd +
	len(passwordHashDivider)

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
	passwordType() passwordType
}

type sha256Password struct {
	hash [sha256.Size]byte
	salt [saltSize]byte
}

var _ password = (*sha256Password)(nil)

func (p *sha256Password) check(_ context.Context, _ *rate.Limiter,
	cleartext string) (match bool, err error) {
	sum := sha256.New()
	if _, err = sum.Write(p.salt[:]); err != nil {
		return false, fmt.Errorf("calculating sha256 error: %v", err)
	}
	if _, err = io.WriteString(sum, cleartext); err != nil {
		return false, fmt.Errorf("calculating sha256 error: %v", err)
	}
	return p.hash == sha256.Sum256(append(p.salt[:], cleartext...)), nil
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

// GenerateSHA256PasswordHash generates a SHA256 based password hash.
func GenerateSHA256PasswordHash(cleartext string) (string, error) {
	salt := make([]byte, saltSize)
	n, err := rand.Read(salt)
	if err != nil || n != saltSize {
		return "", errors.New("reading random bytes error")
	}

	hash := sha256.Sum256(append(salt, cleartext...))
	return sha256PasswordHashPrefix + passwordHashDivider +
		hex.EncodeToString(salt) + passwordHashDivider +
		hex.EncodeToString(hash[:]), nil
}

// newPassword takes a password hash (usually from a .kbp_config file) and
// makes a password object out of it. Accepted password hashes are:
//   1. bcrypt hashes. For example:
//       $2a$04$DXabUWtVUX/nOEQ2R8aBT.wRUZxllKA2Lbm6Z3cGhkRLwMb6u8Esq
//   2. sha256 hashes in format of sha256:<hex of salt>:<hex of sha256sum>.
//      For example:
//       sha256:249704a205894bb003b9f82a:6f2e235f076f1c7e1cfedec477091343dd4b1a678b11554321ee1a493925695c
func newPassword(passwordHashFromConfig string) (password, error) {
	if strings.HasPrefix(passwordHashFromConfig, sha256PasswordHashPrefix) {
		if len(passwordHashFromConfig) != sha256PasswordHashLength {
			return nil, InvalidPasswordHash{}
		}
		salt, err := hex.DecodeString(
			passwordHashFromConfig[sha256PasswordHashSaltIndex:sha256PasswordHashSaltEnd])
		if err != nil {
			return nil, InvalidPasswordHash{}
		}
		hash, err := hex.DecodeString(
			passwordHashFromConfig[sha256PasswordHashSHA256Index:])
		if err != nil {
			return nil, InvalidPasswordHash{}
		}
		p := &sha256Password{}
		copy(p.hash[:], hash)
		copy(p.salt[:], salt)
		return p, nil
	}
	if _, err := bcrypt.Cost([]byte(passwordHashFromConfig)); err == nil {
		return &bcryptCachingPassword{
			bcryptHash: []byte(passwordHashFromConfig),
		}, nil
	}
	return nil, InvalidPasswordHash{}
}
