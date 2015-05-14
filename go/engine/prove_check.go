// ProveCheck looks for an active proof in the logged in user's id
// table for a service, username pair.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

type ProveCheckArg struct {
	Service  string // the remote service name
	Username string // the user's username on Service
}

// ProveCheck is an engine.
type ProveCheck struct {
	libkb.Contextified
	arg   *ProveCheckArg
	proof libkb.RemoteProofChainLink
}

// NewProveCheck creates a ProveCheck engine.
func NewProveCheck(g *libkb.GlobalContext, arg *ProveCheckArg) *ProveCheck {
	return &ProveCheck{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *ProveCheck) Name() string {
	return "ProveCheck"
}

// GetPrereqs returns the engine prereqs.
func (e *ProveCheck) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (e *ProveCheck) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *ProveCheck) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *ProveCheck) Run(ctx *Context) error {
	st := libkb.GetServiceType(e.arg.Service)
	if st == nil {
		return libkb.BadServiceError{Service: e.arg.Service}
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{ForceReload: true})
	if err != nil {
		return err
	}

	proofs := me.IDTable().GetActiveProofsFor(st)
	if len(proofs) == 0 {
		return libkb.ProofNotFoundForServiceError{Service: e.arg.Service}
	}
	last := proofs[len(proofs)-1]
	if last.GetRemoteUsername() != e.arg.Username {
		return libkb.ProofNotFoundForUsernameError{Service: e.arg.Service, Username: e.arg.Username}
	}
	e.proof = last

	return nil
}

func (e *ProveCheck) Proof() libkb.RemoteProofChainLink {
	return e.proof
}
