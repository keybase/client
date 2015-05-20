// ProveCheck looks for an active proof in the logged in user's id
// table for a service, username pair.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// ProveCheck is an engine.
type ProveCheck struct {
	libkb.Contextified
	sigID     libkb.SigId
	found     bool
	status    int
	proofText string
}

// NewProveCheck creates a ProveCheck engine.
func NewProveCheck(g *libkb.GlobalContext, sigID libkb.SigId) *ProveCheck {
	return &ProveCheck{
		Contextified: libkb.NewContextified(g),
		sigID:        sigID,
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
	found, status, err := libkb.CheckPostedViaSigID(e.sigID.ToString(true))
	if err != nil {
		return err
	}
	e.found = found
	e.status = status

	if !e.found {
		return nil
	}

	e.G().Log.Debug("looking for ChainLink for %s", e.sigID.ToString(true))
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		return err
	}
	link := me.LinkFromSigID(e.sigID)
	if link == nil {
		return fmt.Errorf("no chain link found for %s", e.sigID.ToString(true))
	}
	e.G().Log.Debug("chain link found: (%T)", link.Typed())
	if rlink, ok := link.Typed().(libkb.RemoteProofChainLink); ok {
		e.proofText = rlink.ProofText()
	} else {
		e.G().Log.Warning("chain link had invalid type: %T", link.Typed())
	}
	return nil
}

func (e *ProveCheck) Results() (found bool, status int, proofText string) {
	return e.found, e.status, e.proofText
}
