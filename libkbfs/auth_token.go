// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"runtime"
	"sync"
	"time"

	"github.com/keybase/client/go/auth"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// AuthTokenMinRefreshSeconds is the minimum number of seconds between refreshes.
const AuthTokenMinRefreshSeconds = 60

// AuthToken encapsulates a timed authentication token.
type AuthToken struct {
	config         Config
	tokenType      string
	expireIn       int
	clientName     string
	clientVersion  string
	refreshHandler AuthTokenRefreshHandler
	tickerCancel   context.CancelFunc
	tickerMu       sync.Mutex // protects the ticker cancel function
}

// NewAuthToken creates a new authentication token.
func NewAuthToken(config Config, tokenType string, expireIn int,
	submoduleName string, rh AuthTokenRefreshHandler) *AuthToken {
	clientName := fmt.Sprintf("go %s %s %s", submoduleName, runtime.GOOS, runtime.GOARCH)
	authToken := &AuthToken{
		config:         config,
		tokenType:      tokenType,
		expireIn:       expireIn,
		clientName:     clientName,
		clientVersion:  VersionString(),
		refreshHandler: rh,
	}
	return authToken
}

// Sign is called to create a new signed authentication token.
func (a *AuthToken) signWithUserAndKeyInfo(ctx context.Context,
	challengeInfo keybase1.ChallengeInfo, uid keybase1.UID,
	username libkb.NormalizedUsername, key VerifyingKey) (string, error) {
	// create the token
	token := auth.NewToken(uid, username, key.kid, a.tokenType,
		challengeInfo.Challenge, challengeInfo.Now, a.expireIn,
		a.clientName, a.clientVersion)

	// sign the token
	signature, err := a.config.Crypto().SignToString(ctx, token.Bytes())
	if err != nil {
		return "", err
	}

	// reset the ticker
	refreshSeconds := a.expireIn / 2
	if refreshSeconds < AuthTokenMinRefreshSeconds {
		refreshSeconds = AuthTokenMinRefreshSeconds
	}
	a.startTicker(refreshSeconds)

	return signature, nil
}

// Sign is called to create a new signed authentication token,
// including a challenge and username/uid/kid identifiers.
func (a *AuthToken) Sign(ctx context.Context, challengeInfo keybase1.ChallengeInfo) (string, error) {
	// make sure we're being asked to sign a legit challenge
	if !auth.IsValidChallenge(challengeInfo.Challenge) {
		return "", errors.New("Invalid challenge")
	}

	// get UID, deviceKID and normalized username
	username, uid, err := a.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return "", err
	}
	key, err := a.config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return "", err
	}

	return a.signWithUserAndKeyInfo(ctx, challengeInfo, uid, username, key)
}

// SignUserless signs the token without a username, UID, or challenge.
// This is useful for server-to-server communication where identity is
// established using only the KID.  Assume the client and server
// clocks are roughly synchronized.
func (a *AuthToken) SignUserless(ctx context.Context, key VerifyingKey) (
	string, error) {
	// Pass in a reserved, meaningless UID.
	return a.signWithUserAndKeyInfo(ctx,
		keybase1.ChallengeInfo{Now: time.Now().Unix()},
		keybase1.PublicUID, "", key)
}

// Shutdown is called to stop the refresh ticker.
func (a *AuthToken) Shutdown() {
	a.stopTicker()
}

// Helper to start the ticker (if not started.)
func (a *AuthToken) startTicker(intervalSeconds int) {
	a.tickerMu.Lock()
	defer a.tickerMu.Unlock()

	if a.tickerCancel != nil {
		return
	}

	var ctx context.Context
	ctx, a.tickerCancel = context.WithCancel(context.Background())
	go func() {
		ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
		for {
			select {
			case <-ticker.C:
				a.refreshHandler.RefreshAuthToken(ctx)
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

// Helper to stop the refresh ticker.
func (a *AuthToken) stopTicker() {
	a.tickerMu.Lock()
	defer a.tickerMu.Unlock()

	if a.tickerCancel != nil {
		a.tickerCancel()
		a.tickerCancel = nil
	}
}
