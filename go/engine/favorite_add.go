// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// FavoriteAdd is an engine.
type FavoriteAdd struct {
	arg             *keybase1.FavoriteAddArg
	checkInviteDone chan struct{}
	libkb.Contextified
}

// NewFavoriteAdd creates a FavoriteAdd engine.
func NewFavoriteAdd(arg *keybase1.FavoriteAddArg, g *libkb.GlobalContext) *FavoriteAdd {
	return &FavoriteAdd{
		arg:             arg,
		checkInviteDone: make(chan struct{}),
		Contextified:    libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *FavoriteAdd) Name() string {
	return "FavoriteAdd"
}

// GetPrereqs returns the engine prereqs.
func (e *FavoriteAdd) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *FavoriteAdd) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *FavoriteAdd) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *FavoriteAdd) WantDelegate(kind libkb.UIKind) bool {
	if kind == libkb.IdentifyUIKind {
		return true
	}

	return false
}

// Run starts the engine.
func (e *FavoriteAdd) Run(ctx *Context) error {
	if e.arg == nil {
		return fmt.Errorf("FavoriteAdd arg is nil")
	}
	_, err := e.G().API.Post(libkb.APIArg{
		Endpoint:    "kbfs/favorite/add",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"tlf_name":    libkb.S{Val: e.arg.Folder.Name},
			"folder_type": libkb.I{Val: int(e.arg.Folder.FolderType)},
			"status":      libkb.S{Val: "favorite"},
		},
	})
	if err != nil {
		return err
	}

	// this should be in its own goroutine so that potential
	// UI calls don't block FavoriteAdd calls
	go e.checkInviteNeeded(ctx)

	return nil
}

// Wait until the checkInviteNeeded goroutine is done.
func (e *FavoriteAdd) Wait() {
	<-e.checkInviteDone
}

func (e *FavoriteAdd) checkInviteNeeded(ctx *Context) error {
	defer func() {
		close(e.checkInviteDone)
	}()

	// If not folder creator, do nothing.
	if !e.arg.Folder.Created {
		return nil
	}

	for _, user := range strings.Split(e.arg.Folder.Name, ",") {
		assertion, ok := libkb.NormalizeSocialAssertion(e.G().MakeAssertionContext(), user)
		if !ok {
			e.G().Log.Debug("not a social assertion: %s", user)
			continue
		}

		e.G().Log.Debug("social assertion found in FavoriteAdd folder name: %s", assertion)
		e.G().Log.Debug("requesting an invitation for %s", assertion)

		inv, err := libkb.GenerateInvitationCodeForAssertion(e.G(), assertion, libkb.InviteArg{})
		if err != nil {
			return err
		}

		e.G().Log.Debug("invitation requested, informing folder creator with result")
		arg := keybase1.DisplayTLFCreateWithInviteArg{
			FolderName:      e.arg.Folder.Name,
			Assertion:       assertion.String(),
			SocialAssertion: assertion,
			IsPrivate:       e.arg.Folder.FolderType == keybase1.FolderType_PRIVATE,
			Throttled:       inv.Throttled,
			InviteLink:      inv.Link(),
		}
		if err := ctx.IdentifyUI.DisplayTLFCreateWithInvite(arg); err != nil {
			return err
		}
	}

	return nil
}
