// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

func identifyUID(ctx context.Context, nug normalizedUsernameGetter, identifier identifier, uid keybase1.UID, isPublic bool) error {
	username, err := nug.GetNormalizedUsername(ctx, uid)
	if err != nil {
		return err
	}
	var pubOrPri string
	if isPublic {
		pubOrPri = "public"
	} else {
		pubOrPri = "private"
	}
	reason := fmt.Sprintf("You accessed a %s folder with %s.", pubOrPri, username.String())
	userInfo, err := identifier.Identify(ctx, username.String(), reason)
	if err != nil {
		return err
	}
	if userInfo.Name != username {
		return fmt.Errorf("Identify returned name=%s, expected %s", userInfo.Name, username)
	}
	if userInfo.UID != uid {
		return fmt.Errorf("Identify returned uid=%s, expected %s", userInfo.UID, uid)
	}
	return nil
}

// identifyUserList identifies the users in the given list.
func identifyUserList(ctx context.Context, nug normalizedUsernameGetter, identifier identifier, uids []keybase1.UID, public bool) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	errChan := make(chan error, len(uids))
	// TODO: limit the number of concurrent identifies?
	for _, uid := range uids {
		go func(uid keybase1.UID) {
			err := identifyUID(ctx, nug, identifier, uid, public)
			errChan <- err
		}(uid)
	}

	for i := 0; i < len(uids); i++ {
		err := <-errChan
		if err != nil {
			return err
		}
	}

	return nil
}

// identifyHandle identifies the canonical names in the given handle.
func identifyHandle(ctx context.Context, nug normalizedUsernameGetter, identifier identifier, h *TlfHandle) error {
	uids := append(h.ResolvedWriters(), h.ResolvedReaders()...)
	return identifyUserList(ctx, nug, identifier, uids, h.IsPublic())
}
