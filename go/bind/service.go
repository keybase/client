// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type kbservice struct {
	ctx *libkb.GlobalContext
}

func (s *kbservice) Resolve(ctx context.Context, assertion string) (libkb.NormalizedUsername, keybase1.UID, error) {
	username, uid, err := engine.ResolveRun(s.ctx, assertion)
	if err != nil {
		err = libkbfs.ConvertIdentifyError(assertion, err)
	}
	return username, uid, err
}

func (s *kbservice) Identify(_ context.Context, assertion, reason string) (libkbfs.UserInfo, error) {
	upk, err := engine.Identify2Run(s.ctx, assertion, reason)
	if err != nil {
		return libkbfs.UserInfo{}, libkbfs.ConvertIdentifyError(assertion, err)
	}
	return libkbfs.UserInfoFromProtocol(upk)
}

func (s *kbservice) LoadUserPlusKeys(_ context.Context, uid keybase1.UID) (libkbfs.UserInfo, error) {
	// TODO: Do we need caching if we aren't RPC? If caching is implemented
	// in the future, this should also implement FlushUserFromLocalCache.
	upk, err := libkb.LoadUserPlusKeys(s.ctx, uid)
	if err != nil {
		return libkbfs.UserInfo{}, err
	}
	return libkbfs.UserInfoFromProtocol(upk)
}

func (s *kbservice) LoadUnverifiedKeys(_ context.Context, uid keybase1.UID) ([]keybase1.PublicKey, error) {
	// TODO: Do we need caching if we aren't RPC? If caching is implemented
	// in the future, this should also implement FlushUserUnverifiedKeysFromLocalCache.
	user, err := libkb.LoadUserFromServer(s.ctx, uid, nil)
	if err != nil {
		return nil, err
	}
	var publicKeys []keybase1.PublicKey
	if user.GetKeyFamily() != nil {
		publicKeys = user.GetKeyFamily().Export()
	}
	return publicKeys, nil
}

func (s *kbservice) CurrentSession(_ context.Context, sessionID int) (libkbfs.SessionInfo, error) {
	session, err := engine.CurrentSession(s.ctx, sessionID)
	if err != nil {
		return libkbfs.SessionInfo{}, err
	}
	return libkbfs.SessionInfoFromProtocol(session)
}

func (s *kbservice) FavoriteAdd(_ context.Context, folder keybase1.Folder) error {
	return engine.FavoriteAddRun(s.ctx, folder)
}

func (s *kbservice) FavoriteDelete(_ context.Context, folder keybase1.Folder) error {
	return engine.FavoriteIgnoreRun(s.ctx, folder)
}

func (s *kbservice) FavoriteList(_ context.Context, sessionID int) ([]keybase1.Folder, error) {
	return engine.FavoriteListRun(s.ctx, sessionID)
}

func (s *kbservice) Notify(_ context.Context, notification *keybase1.FSNotification) error {
	if notification == nil {
		return fmt.Errorf("Missing notification in notify")
	}
	s.ctx.NotifyRouter.HandleFSActivity(*notification)
	return nil
}

func (s *kbservice) FlushUserFromLocalCache(_ context.Context, uid keybase1.UID) {
	// TODO: No caching is not enabled yet
}

func (s *kbservice) FlushUserUnverifiedKeysFromLocalCache(ctx context.Context, uid keybase1.UID) {
	// TODO: No caching is not enabled yet
}

func (s *kbservice) Shutdown() {
	// There a no resources to cleanup (this is useful for RPC impl)
}
