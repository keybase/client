// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/kbfs/tlf"
	"sync"

	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// EnableAdminFeature returns true if admin features should be enabled
// for the currently-logged-in user.
func EnableAdminFeature(ctx context.Context, runMode kbconst.RunMode, config Config) bool {
	if runMode == kbconst.DevelRunMode {
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

// setupDiskBlockCache sets the user's home TLFs on the disk block cache.
func setupDiskBlockCache(ctx context.Context, config Config, username string) {
	if config.DiskBlockCache() == nil {
		return
	}

	log := config.MakeLogger("")
	publicHandle, err := getHandleFromFolderName(ctx,
		config.KBPKI(), config.MDOps(), username, true)
	if err != nil {
		log.CWarningf(ctx, "serviceLoggedIn: Failed to fetch TLF ID for "+
			"user's public TLF: %+v", err)
	} else if publicHandle.tlfID != tlf.NullID {
		err = config.DiskBlockCache().AddHomeTLF(ctx, publicHandle.tlfID)
		if err != nil {
			log.CWarningf(ctx, "serviceLoggedIn: Failed to set home TLF "+
				"for disk block cache: %+v", err)
		}
	}
	privateHandle, err := getHandleFromFolderName(ctx, config.KBPKI(),
		config.MDOps(), username, false)
	if err != nil {
		log.CWarningf(ctx, "serviceLoggedIn: Failed to fetch TLF ID for "+
			"user's private TLF: %+v", err)
	} else if privateHandle.tlfID != tlf.NullID {
		err = config.DiskBlockCache().AddHomeTLF(ctx, privateHandle.tlfID)
		if err != nil {
			log.CWarningf(ctx, "serviceLoggedIn: Failed to set home TLF "+
				"for disk block cache: %+v", err)
		}
	}
}

// serviceLoggedIn should be called when a new user logs in. It
// shouldn't be called again until after serviceLoggedOut is called.
func serviceLoggedIn(ctx context.Context, config Config, session SessionInfo,
	bws TLFJournalBackgroundWorkStatus) (wg *sync.WaitGroup) {
	wg = &sync.WaitGroup{} // To avoid returning a nil pointer.
	log := config.MakeLogger("")
	if jManager, err := GetJournalManager(config); err == nil {
		err := jManager.EnableExistingJournals(
			ctx, session.UID, session.VerifyingKey, bws)
		if err != nil {
			log.CWarningf(ctx,
				"Failed to enable existing journals: %v", err)
		} else {
			// Initializing the FBOs uses the mdserver, and this
			// function might be called as part of MDServer.OnConnect,
			// so be safe and initialize them in the background to
			// avoid deadlocks.
			newCtx := CtxWithRandomIDReplayable(context.Background(),
				CtxKeybaseServiceIDKey, CtxKeybaseServiceOpID, log)
			log.CDebugf(ctx, "Making FBOs in background: %s=%v",
				CtxKeybaseServiceOpID, newCtx.Value(CtxKeybaseServiceIDKey))
			wg = jManager.MakeFBOsForExistingJournals(newCtx)
		}
	}
	err := config.MakeDiskBlockCacheIfNotExists()
	if err != nil {
		log.CWarningf(ctx, "serviceLoggedIn: Failed to enable disk cache: "+
			"%+v", err)
	}
	// Asynchronously set the TLF IDs for the home folders on the disk block
	// cache.
	go setupDiskBlockCache(context.Background(), config, session.Name.String())

	// Launch auth refreshes in the background, in case we are
	// currently disconnected from one of these servers.
	mdServer := config.MDServer()
	if mdServer != nil {
		go mdServer.RefreshAuthToken(context.Background())
	}
	bServer := config.BlockServer()
	if bServer != nil {
		go bServer.RefreshAuthToken(context.Background())
	}

	// TODO: get IDs and team IDs and put them in the favorites.

	config.KBFSOps().RefreshCachedFavorites(ctx)
	config.KBFSOps().PushStatusChange()
	return wg
}

// serviceLoggedOut should be called when the current user logs out.
func serviceLoggedOut(ctx context.Context, config Config) {
	if jManager, err := GetJournalManager(config); err == nil {
		jManager.shutdownExistingJournals(ctx)
	}
	config.ResetCaches()
	config.UserHistory().Clear()
	config.Chat().ClearCache()
	mdServer := config.MDServer()
	if mdServer != nil {
		mdServer.RefreshAuthToken(ctx)
	}
	bServer := config.BlockServer()
	if bServer != nil {
		bServer.RefreshAuthToken(ctx)
	}
	config.KBFSOps().ClearCachedFavorites(ctx)
	config.KBFSOps().PushStatusChange()

	// Clear any cached MD for all private TLFs, as they shouldn't be
	// readable by a logged out user.  We assume that a logged-out
	// call always comes before a logged-in call.
	config.KBFSOps().ClearPrivateFolderMD(ctx)
}
