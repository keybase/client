// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package process

import (
	"strings"

	"github.com/keybase/go-ps"
)

// MatchFn is a process matching function
type MatchFn func(ps.Process) bool

// Matcher can match a process
type Matcher struct {
	match     string
	matchType MatchType
	exceptPID int
	log       Log
}

// MatchType is how to match
type MatchType string

const (
	// PathEqual matches path equals string
	PathEqual MatchType = "path-equal"
	// PathContains matches path contains string
	PathContains MatchType = "path-contains"
	// PathPrefix matches path has string prefix
	PathPrefix MatchType = "path-prefix"
)

// NewMatcher returns a new matcher
func NewMatcher(match string, matchType MatchType, log Log) Matcher {
	return Matcher{match: match, matchType: matchType, log: log}
}

// ExceptPID will not match specified pid
func (m *Matcher) ExceptPID(p int) {
	m.exceptPID = p
}

func (m Matcher) matchPathFn(pathFn func(path, str string) bool) MatchFn {
	return func(p ps.Process) bool {
		if m.exceptPID != 0 && p.Pid() == m.exceptPID {
			return false
		}
		path, err := p.Path()
		if err != nil {
			//m.log.Warningf("Unable to get path for process %q: %s", p.Executable(), err)
			return false
		}
		return pathFn(path, m.match)
	}
}

// Fn is the matching function
func (m Matcher) Fn() MatchFn {
	switch m.matchType {
	case PathEqual:
		return m.EqualPathFn()
	case PathContains:
		return m.ContainsPathFn()
	case PathPrefix:
		return m.PrefixPathFn()
	default:
		return nil
	}
}

// EqualPathFn matches on path equals string
func (m Matcher) EqualPathFn() MatchFn {
	return m.matchPathFn(func(s, t string) bool {
		return s == t
	})
}

// ContainsPathFn matches on path contains string
func (m Matcher) ContainsPathFn() MatchFn {
	return m.matchPathFn(func(path, str string) bool {
		return strings.Contains(path, str)
	})
}

// PrefixPathFn matches on path starts with string
func (m Matcher) PrefixPathFn() MatchFn {
	return m.matchPathFn(func(path, str string) bool {
		return strings.HasPrefix(path, str)
	})
}
