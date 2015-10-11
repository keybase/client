package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
)

type ProofChecker interface {
	CheckHint(h SigHint) ProofError
	CheckStatus(h SigHint) ProofError
}

//
//=============================================================================

//=============================================================================
//

type ProofCheckHook func(l RemoteProofChainLink) (ProofChecker, ProofError)

var _dispatch = make(map[string]ProofCheckHook)

func RegisterProofCheckHook(s string, h ProofCheckHook) {
	_dispatch[s] = h
}

func NewProofChecker(l RemoteProofChainLink) (ProofChecker, ProofError) {
	k := l.TableKey()
	hook, found := _dispatch[l.TableKey()]
	if !found {
		return nil, NewProofError(keybase1.ProofStatus_UNKNOWN_TYPE,
			"No proof checker for type: %s", k)
	}
	return hook(l)
}

//
//=============================================================================
