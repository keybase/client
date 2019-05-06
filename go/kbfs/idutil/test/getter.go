// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/kbfs/idutil"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

// NormalizedUsernameGetter is a simple map of IDs -> usernames that
// can be useful for testing.
type NormalizedUsernameGetter map[keybase1.UserOrTeamID]kbname.NormalizedUsername

var _ idutil.NormalizedUsernameGetter = NormalizedUsernameGetter{}

// GetNormalizedUsername implements the idutil.NormalizedUsernameGetter
// interface for NormalizedUsernameGetter.
func (g NormalizedUsernameGetter) GetNormalizedUsername(
	ctx context.Context, id keybase1.UserOrTeamID,
	_ keybase1.OfflineAvailability) (kbname.NormalizedUsername, error) {
	name, ok := g[id]
	if !ok {
		return kbname.NormalizedUsername(""),
			idutil.NoSuchUserError{Input: fmt.Sprintf("uid:%s", id)}
	}
	return name, nil
}

// UIDMap converts this getter into a typed map of user IDs ->
// normalized names.
func (g NormalizedUsernameGetter) UIDMap() map[keybase1.UserOrTeamID]kbname.NormalizedUsername {
	return (map[keybase1.UserOrTeamID]kbname.NormalizedUsername)(g)
}
