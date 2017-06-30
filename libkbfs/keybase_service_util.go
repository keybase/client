// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/env"
	"golang.org/x/net/context"
)

// TODO: Add a server endpoint to get this data.
var adminFeatureList = map[keybase1.UID]bool{
	"23260c2ce19420f97b58d7d95b68ca00": true, // Chris Coyne "chris"
	"dbb165b7879fe7b1174df73bed0b9500": true, // Max Krohn, "max"
	"ef2e49961eddaa77094b45ed635cfc00": true, // Jeremy Stribling, "strib"
	"41b1f75fb55046d370608425a3208100": true, // Jack O'Connor, "oconnor663"
	"9403ede05906b942fd7361f40a679500": true, // Jinyang Li, "jinyang"
	"b7c2eaddcced7727bcb229751d91e800": true, // Gabriel Handford, "gabrielh"
	"1563ec26dc20fd162a4f783551141200": true, // Patrick Crosby, "patrick"
	"ebbe1d99410ab70123262cf8dfc87900": true, // Fred Akalin, "akalin"
	"e0b4166c9c839275cf5633ff65c3e819": true, // Chris Nojima, "chrisnojima"
	"d95f137b3b4a3600bc9e39350adba819": true, // Cécile Boucheron, "cecileb"
	"4c230ae8d2f922dc2ccc1d2f94890700": true, // Marco Polo, "marcopolo"
	"237e85db5d939fbd4b84999331638200": true, // Chris Ball, "cjb"
	"69da56f622a2ac750b8e590c3658a700": true, // John Zila, "jzila"
	"673a740cd20fb4bd348738b16d228219": true, // Steve Sanders, "zanderz"
	"95e88f2087e480cae28f08d81554bc00": true, // Mike Maxim, "mikem"
	"5c2ef2d4eddd2381daa681ac1a901519": true, // Max Goodman, "chromakode"
	"08abe80bd2da8984534b2d8f7b12c700": true, // Song Gao, "songgao"
	"eb08cb06e608ea41bd893946445d7919": true, // Miles Steele, "mlsteele"
	"743338e8d5987e0e5077f0fddc763f19": true, // Taru Karttunen, "taruti"
	"ee71dbc8e4e3e671e29a94caef5e1b19": true, // Michał Zochniak, "zapu"
	"0cfef3bacae68424de9bec5b7ff58600": true, // Andrey Petrov, "shazow"
	"b848bce3d54a76e4da323aad2957e819": true, // Surya, "modalduality"
}

// EnableAdminFeature returns true if admin features should be enabled
// for the currently-logged-in user.
func EnableAdminFeature(ctx context.Context, config Config) bool {
	if env.NewContext().GetRunMode() == libkb.DevelRunMode {
		// All users in devel mode are admins.
		return true
	}
	const sessionID = 0
	session, err := config.KeybaseService().CurrentSession(ctx, sessionID)
	if err != nil {
		return false
	}
	return adminFeatureList[session.UID]
}

// serviceLoggedIn should be called when a new user logs in. It
// shouldn't be called again until after serviceLoggedOut is called.
func serviceLoggedIn(ctx context.Context, config Config, name string,
	bws TLFJournalBackgroundWorkStatus) {
	log := config.MakeLogger("")
	const sessionID = 0
	session, err := config.KeybaseService().CurrentSession(ctx, sessionID)
	if err != nil {
		log.CDebugf(ctx, "Getting current session failed when %s is logged in, so pretending user has logged out: %v",
			name, err)
		serviceLoggedOut(ctx, config)
		return
	}

	if jServer, err := GetJournalServer(config); err == nil {
		err := jServer.EnableExistingJournals(
			ctx, session.UID, session.VerifyingKey, bws)
		if err != nil {
			log.CWarningf(ctx,
				"Failed to enable existing journals: %v", err)
		}
	}
	if config.DiskBlockCache() == nil {
		dbc, err := newDiskBlockCacheStandard(config,
			diskBlockCacheRootFromStorageRoot(config.StorageRoot()))
		if err == nil {
			config.SetDiskBlockCache(dbc)
		}
	}

	config.MDServer().RefreshAuthToken(ctx)
	config.BlockServer().RefreshAuthToken(ctx)
	config.KBFSOps().RefreshCachedFavorites(ctx)
	config.KBFSOps().PushStatusChange()
}

// serviceLoggedOut should be called when the current user logs out.
func serviceLoggedOut(ctx context.Context, config Config) {
	if jServer, err := GetJournalServer(config); err == nil {
		jServer.shutdownExistingJournals(ctx)
	}
	config.ResetCaches()
	config.MDServer().RefreshAuthToken(ctx)
	config.BlockServer().RefreshAuthToken(ctx)
	config.KBFSOps().RefreshCachedFavorites(ctx)
	config.KBFSOps().PushStatusChange()

	// Clear any cached MD for all private TLFs, as they shouldn't be
	// readable by a logged out user.  We assume that a logged-out
	// call always comes before a logged-in call.
	config.KBFSOps().ClearPrivateFolderMD(ctx)
}
