// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"regexp"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// A store of named immutable (set-once) registers.
type namedRegsStore struct {
	// Values of set registers
	m map[string]string
	// Registers that cannot be set or read
	banned map[string]bool
}

func newNamedRegsStore() *namedRegsStore {
	return &namedRegsStore{
		m:      make(map[string]string),
		banned: make(map[string]bool),
	}
}

func (r *namedRegsStore) Get(key string) (string, libkb.ProofError) {
	err := r.validateKey(key)
	if err != nil {
		return "", err
	}
	banned := r.banned[key]
	if banned {
		return "", libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "banned key '%v'", key)
	}
	val, ok := r.m[key]
	if !ok {
		return "", libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "register '%v' is not set", key)
	}
	return val, nil
}

func (r *namedRegsStore) Set(key string, val string) libkb.ProofError {
	err := r.validateKey(key)
	if err != nil {
		return err
	}
	banned := r.banned[key]
	if banned {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "banned key '%v'", key)
	}
	_, alreadySet := r.m[key]
	if alreadySet {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "register '%v' was already set", key)
	}
	r.m[key] = val
	return nil
}

// Mark a register as unuseable
func (r *namedRegsStore) Ban(key string) libkb.ProofError {
	err := r.validateKey(key)
	if err != nil {
		return err
	}
	_, banned := r.banned[key]
	if banned {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "cannot ban already banned register '%v'", key)
	}
	_, set := r.m[key]
	if set {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "cannot ban already set register '%v'", key)
	}
	r.banned[key] = true
	return nil
}

var keyRE = regexp.MustCompile(`^[a-z0-9_]+$`)

// Make sure a key is a simple snake case name.
// Does not check whether it's banned.
func (r *namedRegsStore) validateKey(key string) libkb.ProofError {
	if !keyRE.MatchString(key) {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "invalid register name '%v'", key)
	}
	return nil
}
