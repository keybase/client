package maps

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// backgroundActiveOwner records a BACKGROUND to BACKGROUNDACTIVE transition
// made for live location, so that tracking can undo exactly that transition.
// Callers serialize access.
type backgroundActiveOwner struct {
	gen uint64
}

func (o *backgroundActiveOwner) claim(appState *libkb.MobileAppState) {
	gen, applied, _ := appState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE,
		func(s keybase1.MobileAppState) bool { return s == keybase1.MobileAppState_BACKGROUND })
	if applied {
		o.gen = gen
	}
}

// release returns to BACKGROUND only if nothing has updated the app state
// since claim.
func (o *backgroundActiveOwner) release(appState *libkb.MobileAppState) {
	if o.gen == 0 {
		return
	}
	appState.UpdateIfGeneration(o.gen, keybase1.MobileAppState_BACKGROUND)
	o.gen = 0
}
