// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// EnableAdminFeature returns true if admin features should be enabled
// for the currently-logged-in user.
func EnableAdminFeature(ctx context.Context, runMode libkb.RunMode, config Config) bool {
	if runMode == libkb.DevelRunMode {
		// All users in devel mode are admins.
		return true
	}
	const sessionID = 0
	session, err := config.KeybaseService().CurrentSession(ctx, sessionID)
	if err != nil {
		return false
	}
	return libkb.IsKeybaseAdmin(session.UID)
}

// serviceLoggedIn should be called when a new user logs in. It
// shouldn't be called again until after serviceLoggedOut is called.
func serviceLoggedIn(ctx context.Context, config Config, session SessionInfo,
	bws TLFJournalBackgroundWorkStatus) {
	log := config.MakeLogger("")
	if jServer, err := GetJournalServer(config); err == nil {
		err := jServer.EnableExistingJournals(
			ctx, session.UID, session.VerifyingKey, bws)
		if err != nil {
			log.CWarningf(ctx,
				"Failed to enable existing journals: %v", err)
		}
	}
	err := config.MakeDiskBlockCacheIfNotExists()
	if err != nil {
		log.CWarningf(ctx, "serviceLoggedIn: Failed to enable disk cache: "+
			"%+v", err)
	}

	mdServer := config.MDServer()
	if mdServer != nil {
		mdServer.RefreshAuthToken(ctx)
	}
	bServer := config.BlockServer()
	if bServer != nil {
		bServer.RefreshAuthToken(ctx)
	}
	config.KBFSOps().RefreshCachedFavorites(ctx)
	config.KBFSOps().PushStatusChange()
}

// serviceLoggedOut should be called when the current user logs out.
func serviceLoggedOut(ctx context.Context, config Config) {
	if jServer, err := GetJournalServer(config); err == nil {
		jServer.shutdownExistingJournals(ctx)
	}
	config.ResetCaches()
	config.UserHistory().Clear()
	mdServer := config.MDServer()
	if mdServer != nil {
		mdServer.RefreshAuthToken(ctx)
	}
	bServer := config.BlockServer()
	if bServer != nil {
		bServer.RefreshAuthToken(ctx)
	}
	config.KBFSOps().RefreshCachedFavorites(ctx)
	config.KBFSOps().PushStatusChange()

	// Clear any cached MD for all private TLFs, as they shouldn't be
	// readable by a logged out user.  We assume that a logged-out
	// call always comes before a logged-in call.
	config.KBFSOps().ClearPrivateFolderMD(ctx)
}
