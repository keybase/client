// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
)

// ProofChecker is an interface for performing a remote check for a proof
type ProofChecker interface {
	CheckHint(g *GlobalContext, h SigHint) ProofError
	CheckStatus(g *GlobalContext, h SigHint) ProofError
	GetTorError() ProofError
}

// MakeProofCheckFunc is a function that given a remoteProofChainLink
// will make a ProofChecker.
type MakeProofCheckerFunc func(l RemoteProofChainLink) (ProofChecker, ProofError)

// ProofCheckerFactory makes a ProofChecker. In production, we'll only
// need the global set of ProofCheckers, but for testing, we want to
// stub them out.
type ProofCheckerFactory interface {
	MakeProofChecker(l RemoteProofChainLink) (ProofChecker, ProofError)
}

// A local dispatch table to register global proof-checker maker functions
var _dispatch = make(map[string]MakeProofCheckerFunc)

// RegisterMakeProofCheckerFunc registers a MakeProofCheckerFunc to work
// with the given type of proof.
func RegisterMakeProofCheckerFunc(s string, h MakeProofCheckerFunc) {
	_dispatch[s] = h
}

func newProofChecker(l RemoteProofChainLink) (ProofChecker, ProofError) {
	k := l.TableKey()
	hook, found := _dispatch[l.TableKey()]
	if !found {
		return nil, NewProofError(keybase1.ProofStatus_UNKNOWN_TYPE,
			"No proof checker for type: %s", k)
	}
	return hook(l)
}

// The defaultProofCheckerFactory is the one to use in production; it just uses the
// default code to allocate real proof checkers.
type defaultProofCheckerFactoryDummyType struct{}

func (d defaultProofCheckerFactoryDummyType) MakeProofChecker(l RemoteProofChainLink) (ProofChecker, ProofError) {
	return newProofChecker(l)
}

var defaultProofCheckerFactory defaultProofCheckerFactoryDummyType
