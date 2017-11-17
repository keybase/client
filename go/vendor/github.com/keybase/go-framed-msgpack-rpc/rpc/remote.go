// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package rpc

import (
	"errors"
	"math/rand"
	"strings"
	"sync"
)

// Remote defines an address or a group of addresses that all point to a remote
// that we can connect to.
type Remote interface {
	// GetAddress gets an address of the Remote to connect to.
	GetAddress() string
	// Peek returns an address of the Remote to connect to without changing the
	// internal state. The returned address is what GetAddress() would return
	// if called.
	Peek() string
	// Reset resets the internal counter so that next call to GetAddress()
	// returns an address as if it were called the first time.
	Reset()
	// String returns a string that represents all addresses in Remote and can
	// be used to construct a Remote that behaves the same way.
	String() string
}

type fixedRemote string

// NewFixedRemote returns a remote that always uses remoteAddr.
func NewFixedRemote(remoteAddr string) Remote {
	return fixedRemote(remoteAddr)
}

// GetAddress implements the Remote interface.
func (r fixedRemote) GetAddress() string {
	return string(r)
}

// Peek implements the Remote interface.
func (r fixedRemote) Peek() string {
	return string(r)
}

// Reset implements the Remote interface.
func (r fixedRemote) Reset() {}

// String implements the Remote interface.
func (r fixedRemote) String() string {
	return string(r)
}

type prioritizedRoundRobinRemote struct {
	addresses [][]string

	lock      sync.Mutex
	toIterate [][]string
}

// NewPrioritizedRoundRobinRemote creates a new Remote that include
// prioritized remote groups. Each call to GetAddress() will round-robin by
// random order within the first group. If we run out of address within the
// first group, fallback to second group and do the same thing, until we've
// iterated all groups where we'll start over from first group.
//
// Any successful connecting attempt should result in a call to Reset(). This
// is generally handled by the rpc package itself and shouldn't be worried
// about by the user of rpc package unless noted otherwise.
func NewPrioritizedRoundRobinRemote(addressGroups [][]string) (Remote, error) {
	// filter out empty ones
	cleaned := make([][]string, 0, len(addressGroups))
	for _, group := range addressGroups {
		cleanedGroup := make([]string, 0, len(group))
		for _, addr := range group {
			addr := strings.ToLower(strings.TrimSpace(addr))
			if len(addr) > 0 {
				cleanedGroup = append(cleanedGroup, addr)
			}
		}
		if len(cleanedGroup) > 0 {
			cleaned = append(cleaned, cleanedGroup)
		}
	}

	if len(cleaned) == 0 {
		return nil, errors.New("addressGroups has no address")
	}

	r := &prioritizedRoundRobinRemote{
		addresses: cleaned,
	}
	r.resetLocked()
	return r, nil
}

func (r *prioritizedRoundRobinRemote) resetLocked() {
	r.toIterate = make([][]string, 0, len(r.addresses))
	for _, group := range r.addresses {
		groupCopied := make([]string, 0, len(group))
		for _, i := range rand.Perm(len(group)) {
			groupCopied = append(groupCopied, group[i])
		}
		r.toIterate = append(r.toIterate, groupCopied)
	}
}

// Reset implements the Remote interface.
func (r *prioritizedRoundRobinRemote) Reset() {
	r.lock.Lock()
	defer r.lock.Unlock()

	r.resetLocked()
}

// GetAddress implements the Remote interface.
func (r *prioritizedRoundRobinRemote) GetAddress() string {
	r.lock.Lock()
	defer r.lock.Unlock()

	// If we have run out of addresses, reset to include all addresses and
	// start over on next call.
	if len(r.toIterate) == 0 {
		r.resetLocked()
	}

	addr := r.toIterate[0][0]

	// Prune one address. Also prune the address group if it's empty.
	r.toIterate[0] = r.toIterate[0][1:]
	for len(r.toIterate) != 0 && len(r.toIterate[0]) == 0 {
		r.toIterate = r.toIterate[1:]
	}

	return addr
}

// Peek implements the Remote interface.
func (r *prioritizedRoundRobinRemote) Peek() string {
	// If we have run out of addresses, reset to include all addresses and
	// start over on next call.
	if len(r.toIterate) == 0 {
		r.resetLocked()
	}

	return r.toIterate[0][0]
}

func (r *prioritizedRoundRobinRemote) String() string {
	addressGroups := make([]string, 0, len(r.addresses))
	for _, group := range r.addresses {
		addressGroups = append(addressGroups, strings.Join(group, ","))
	}
	return strings.Join(addressGroups, ";")
}

// ParsePrioritizedRoundRobinRemote parses a string into a prioritized
// round robin Remote. See doc for NewPrioritizedRoundRobinRemote for details
// on the returned Remote.
//
// Example:
//   "example0.com,example1.com;example0.net,example1.net" produces a
//   prioritized round robin remote with two groups, first .com then .net.
func ParsePrioritizedRoundRobinRemote(str string) (Remote, error) {
	groups := strings.Split(str, ";")
	addressGroups := make([][]string, 0, len(groups))
	for _, group := range groups {
		addressGroups = append(addressGroups, strings.Split(group, ","))
	}
	return NewPrioritizedRoundRobinRemote(addressGroups)
}
