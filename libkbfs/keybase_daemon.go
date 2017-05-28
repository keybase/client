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
	"github.com/keybase/client/go/protocol/keybase1"
)

// keybaseDaemon is the default KeybaseServiceCn implementation, which
// can use the RPC or local (for debug).
type keybaseDaemon struct{}

func (k keybaseDaemon) NewKeybaseService(config Config, params InitParams, ctx Context, log logger.Logger) (KeybaseService, error) {
	localUser := libkb.NewNormalizedUsername(params.LocalUser)
	if len(localUser) == 0 {
		err := ctx.ConfigureSocketInfo()
		if err != nil {
			return nil, err
		}
		return NewKeybaseDaemonRPC(config, ctx, log, params.Debug, params.CreateSimpleFSInstance), nil
	}

	users := []libkb.NormalizedUsername{
		"strib", "max", "chris", "akalin", "jzila", "alness",
		"jinyang", "songgao", "taru", "zanderz",
	}
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
	localUsers[4].Asserts = []string{"twitter:jzila"}
	localUsers[5].Asserts = []string{"github:aalness"}
	localUsers[6].Asserts = []string{"github:jinyangli"}
	localUsers[7].Asserts = []string{"github:songgao"}
	// No asserts for 8.
	localUsers[9].Asserts = []string{"github:zanderz"}

	localUID := localUsers[userIndex].UID
	codec := config.Codec()

	teams := MakeLocalTeams([]libkb.NormalizedUsername{"kbfs", "core", "dokan"})
	for i := range teams {
		teams[i].Writers = make(map[keybase1.UID]bool)
		teams[i].Readers = make(map[keybase1.UID]bool)
		switch teams[i].Name {
		case "kbfs":
			teams[i].Writers[localUsers[0].UID] = true // strib
			teams[i].Writers[localUsers[3].UID] = true // akalin
			teams[i].Writers[localUsers[4].UID] = true // jzila
			teams[i].Writers[localUsers[6].UID] = true // jinyang
			teams[i].Writers[localUsers[7].UID] = true // songgao
			teams[i].Writers[localUsers[8].UID] = true // taru
			// readers
			teams[i].Readers[localUsers[1].UID] = true // max
			teams[i].Readers[localUsers[2].UID] = true // chris
		case "core":
			teams[i].Writers[localUsers[1].UID] = true // max
			// readers
			teams[i].Readers[localUsers[0].UID] = true // strib
			teams[i].Readers[localUsers[2].UID] = true // chris
			teams[i].Readers[localUsers[3].UID] = true // akalin
			teams[i].Readers[localUsers[4].UID] = true // jzila
			teams[i].Readers[localUsers[6].UID] = true // jinyang
			teams[i].Readers[localUsers[7].UID] = true // songgao
			teams[i].Readers[localUsers[8].UID] = true // taru
		case "dokan":
			teams[i].Readers[localUsers[8].UID] = true // taru
			teams[i].Readers[localUsers[9].UID] = true // zanderz
		}
	}

	if params.LocalFavoriteStorage == memoryAddr {
		return NewKeybaseDaemonMemory(localUID, localUsers, teams, codec), nil
	}

	if serverRootDir, ok := parseRootDir(params.LocalFavoriteStorage); ok {
		favPath := filepath.Join(serverRootDir, "kbfs_favs")
		return NewKeybaseDaemonDisk(localUID, localUsers, teams, favPath, codec)
	}

	return nil, errors.New("Can't user localuser without LocalFavoriteStorage being 'memory' or 'dir:/path/to/dir'")
}

func (k keybaseDaemon) NewCrypto(config Config, params InitParams, ctx Context, log logger.Logger) (Crypto, error) {
	var crypto Crypto
	localUser := libkb.NewNormalizedUsername(params.LocalUser)
	if localUser == "" {
		crypto = NewCryptoClientRPC(config, ctx)
	} else {
		signingKey := MakeLocalUserSigningKeyOrBust(localUser)
		cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(localUser)
		crypto = NewCryptoLocal(
			config.Codec(), signingKey, cryptPrivateKey)
	}
	return crypto, nil
}
