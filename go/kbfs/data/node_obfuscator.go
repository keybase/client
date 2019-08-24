// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/keybase/client/go/libkb"
)

const (
	separator = "-"
)

// NodeObfuscatorSecret is a byte slice wrapper for a secret that can
// be passed to `NodeObfuscator`.  It overrides `String` so there's no
// chance of the secret being accidentally logged.
type NodeObfuscatorSecret []byte

// String implements the `fmt.Stringer` interface for NodeObfuscatorSecret.
func (nos NodeObfuscatorSecret) String() string {
	return fmt.Sprintf("{private %d bytes}", len(nos))
}

// NodeObfuscator takes a secret, and uses it to create obfuscate
// strings based on BIP-0039 dictionary words.  It remembers previous
// obfuscations, and if there happens to be a collision on the
// obfuscated text for a new plaintext string, it appends a numeric
// suffix to the new obfuscation.
type NodeObfuscator struct {
	secret NodeObfuscatorSecret

	lock     sync.RWMutex
	obsCache map[string]string
	usedObs  map[string]bool
}

var _ Obfuscator = (*NodeObfuscator)(nil)

// NewNodeObfuscator creates a new `NodeObfuscator` instance.
func NewNodeObfuscator(secret NodeObfuscatorSecret) *NodeObfuscator {
	return &NodeObfuscator{
		secret: secret,
		// Don't initialize caches yet, for memory reasons, in case
		// they're never used.
	}
}

func (no *NodeObfuscator) checkCacheIfExistsLocked(
	plaintext string) (string, bool) {
	if no.obsCache == nil {
		return "", false
	}

	obs, ok := no.obsCache[plaintext]
	return obs, ok
}

func (no *NodeObfuscator) checkCacheIfExists(plaintext string) (string, bool) {
	no.lock.RLock()
	defer no.lock.RUnlock()
	return no.checkCacheIfExistsLocked(plaintext)
}

func (no *NodeObfuscator) obfuscateWithHasher(
	plaintext string, hasher func(string) []byte) string {
	obs, ok := no.checkCacheIfExists(plaintext)
	if ok {
		return obs
	}

	no.lock.Lock()
	defer no.lock.Unlock()
	// See if it's been cached since we last released the lock.
	obs, ok = no.checkCacheIfExistsLocked(plaintext)
	if ok {
		return obs
	}

	if no.obsCache == nil {
		no.obsCache = make(map[string]string)
		no.usedObs = make(map[string]bool)
	}

	// HMAC the plaintext with the secret, to get a hash.
	buf := hasher(plaintext)

	// Look up two words based on the first three bytes of the mac.
	// (Each word takes 11 bits to lookup a unique word among the 2048
	// secret words.)

	// Put the first 22 bits in an int.
	b := (int(buf[0])<<16 | int(buf[1])<<8 | int(buf[2])) >> 2

	second := b & (1<<11 - 1) // second 11 bits are the second word.
	first := b >> 11          // first 11 bits are the first word.

	firstWord := libkb.SecWord(first)
	secondWord := libkb.SecWord(second)
	obs = strings.Join([]string{firstWord, secondWord}, separator)

	suffix := 1
	for no.usedObs[obs] {
		suffix++
		obs = strings.Join(
			[]string{firstWord, secondWord, strconv.Itoa(suffix)}, separator)
	}

	no.obsCache[plaintext] = obs
	no.usedObs[obs] = true
	return obs
}

func (no *NodeObfuscator) defaultHash(plaintext string) []byte {
	mac := hmac.New(sha256.New, no.secret)
	_, _ = mac.Write([]byte(plaintext))
	return mac.Sum(nil)
}

// Obfuscate implements the `Obfuscator` interface for NodeObfuscator.
func (no *NodeObfuscator) Obfuscate(plaintext string) string {
	return no.obfuscateWithHasher(plaintext, no.defaultHash)
}
