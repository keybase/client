// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
)

// keybaseDaemon is the default KeybaseServiceCn implementation, which
// can use the RPC or local (for debug).
type keybaseDaemon struct{}

func (k keybaseDaemon) NewKeybaseService(config Config, params InitParams, ctx Context, log logger.Logger) (KeybaseService, error) {
	localUser := libkb.NewNormalizedUsername(params.LocalUser)
	if len(localUser) == 0 {
		ctx.ConfigureSocketInfo()
		return NewKeybaseDaemonRPC(config, ctx, log, params.Debug), nil
	}

	users := []libkb.NormalizedUsername{"strib", "max", "chris", "fred"}
	userIndex := -1
	for i := range users {
		if localUser == users[i] {
			userIndex = i
			break
		}
	}
	if userIndex < 0 {
		return nil, fmt.Errorf("user %s not in list %v", localUser, users)
	}

	localUsers := MakeLocalUsers(users)

	// TODO: Auto-generate these, too?
	localUsers[0].Asserts = []string{"github:strib"}
	localUsers[1].Asserts = []string{"twitter:maxtaco"}
	localUsers[2].Asserts = []string{"twitter:malgorithms"}
	localUsers[3].Asserts = []string{"twitter:fakalin"}

	localUID := localUsers[userIndex].UID
	codec := config.Codec()
	serverInMemory, serverRootDir := params.ServerInMemory, params.ServerRootDir

	if serverInMemory {
		return NewKeybaseDaemonMemory(localUID, localUsers, codec), nil
	}

	if len(serverRootDir) > 0 {
		favPath := filepath.Join(serverRootDir, "kbfs_favs")
		return NewKeybaseDaemonDisk(localUID, localUsers, favPath, codec)
	}

	return nil, errors.New("Can't user localuser without a local server")
}

func (k keybaseDaemon) NewCrypto(config Config, params InitParams, ctx Context, log logger.Logger) (Crypto, error) {
	var crypto Crypto
	localUser := libkb.NewNormalizedUsername(params.LocalUser)
	if localUser == "" {
		crypto = NewCryptoClientRPC(config, ctx)
	} else {
		signingKey := MakeLocalUserSigningKeyOrBust(localUser)
		cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(localUser)
		crypto = NewCryptoLocal(config, signingKey, cryptPrivateKey)
	}
	return crypto, nil
}
