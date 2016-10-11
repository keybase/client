// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type extendedIdentify struct {
	behavior   keybase1.TLFIdentifyBehavior
	userBreaks chan keybase1.TLFUserBreak

	tlfBreaksLock sync.Mutex
	tlfBreaks     *keybase1.TLFBreak
}

func (ei *extendedIdentify) userBreak(username libkb.NormalizedUsername, uid keybase1.UID, breaks *keybase1.IdentifyTrackBreaks) {
	if ei.userBreaks == nil {
		return
	}

	ei.userBreaks <- keybase1.TLFUserBreak{
		Breaks: breaks,
		User: keybase1.User{
			Uid:      uid,
			Username: string(username),
		},
	}
}

func (ei *extendedIdentify) makeTlfBreaksIfNeeded(
	ctx context.Context, numUserInTlf int) error {
	if ei.userBreaks == nil {
		return nil
	}

	b := &keybase1.TLFBreak{}
	for i := 0; i < numUserInTlf; i++ {
		select {
		case ub, ok := <-ei.userBreaks:
			if !ok {
				return errors.New("makeTlfBreaksIfNeeded called on extendedIdentify" +
					" with closed userBreaks channel.")
			}
			if ub.Breaks != nil {
				b.Breaks = append(b.Breaks, ub)
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	ei.tlfBreaksLock.Lock()
	defer ei.tlfBreaksLock.Unlock()
	ei.tlfBreaks = b

	return nil
}

// getTlfBreakOrBust returns a keybase1.TLFBreak. This should only be called
// for behavior.WarningInsteadOfErrorOnBrokenTracks() == true, and after
// makeTlfBreaksIfNeeded is called. Otherwise it panics.
func (ei *extendedIdentify) getTlfBreakOrBust() keybase1.TLFBreak {
	ei.tlfBreaksLock.Lock()
	defer ei.tlfBreaksLock.Unlock()
	close(ei.userBreaks)
	return *ei.tlfBreaks
}

// ctxExtendedIdentifyKeyType is a type for the context key for using
// extendedIdentify
type ctxExtendedIdentifyKeyType int

const (
	// ctxExtendedIdentifyKeyType is a context key for using extendedIdentify
	ctxExtendedIdentifyKey ctxExtendedIdentifyKeyType = iota
)

// ExtendedIdentifyAlreadyExists is returned when makeExtendedIdentify is
// called on a context already with extendedIdentify.
type ExtendedIdentifyAlreadyExists struct{}

func (e ExtendedIdentifyAlreadyExists) Error() string {
	return "extendedIdentify already exists"
}

func makeExtendedIdentify(ctx context.Context,
	behavior keybase1.TLFIdentifyBehavior) (context.Context, error) {
	if _, ok := ctx.Value(ctxExtendedIdentifyKey).(*extendedIdentify); ok {
		return nil, ExtendedIdentifyAlreadyExists{}
	}

	if !behavior.WarningInsteadOfErrorOnBrokenTracks() {
		return NewContextReplayable(ctx, func(ctx context.Context) context.Context {
			return context.WithValue(ctx, ctxExtendedIdentifyKey, &extendedIdentify{
				behavior: behavior,
			})
		}), nil
	}

	return NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, ctxExtendedIdentifyKey, &extendedIdentify{
			behavior:   behavior,
			userBreaks: make(chan keybase1.TLFUserBreak),
		})
	}), nil
}

func getExtendedIdentify(ctx context.Context) (ei *extendedIdentify) {
	if ei, ok := ctx.Value(ctxExtendedIdentifyKey).(*extendedIdentify); ok {
		return ei
	}
	return &extendedIdentify{
		behavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	}
}

func identifyUID(ctx context.Context, nug normalizedUsernameGetter, identifier identifier, uid keybase1.UID, isPublic bool) error {
	username, err := nug.GetNormalizedUsername(ctx, uid)
	if err != nil {
		return err
	}
	var reason string
	if isPublic {
		reason = "You accessed a public folder."
	} else {
		reason = fmt.Sprintf("You accessed a private folder with %s.", username.String())
	}
	userInfo, err := identifier.Identify(ctx, username.String(), reason)
	if err != nil {
		// Convert libkb.NoSigChainError into one we can report.  (See
		// KBFS-1252).
		if _, ok := err.(libkb.NoSigChainError); ok {
			return NoSigChainError{username}
		}
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
	// TODO: limit the number of concurrent identifies? Otherwise we can use
	// errgroup.Group here.
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

func identifyUserListForTLF(ctx context.Context, nug normalizedUsernameGetter, identifier identifier, uids []keybase1.UID, public bool) error {
	eg, ctx := errgroup.WithContext(ctx)

	eg.Go(func() error {
		ei := getExtendedIdentify(ctx)
		return ei.makeTlfBreaksIfNeeded(ctx, len(uids))
	})

	eg.Go(func() error {
		return identifyUserList(ctx, nug, identifier, uids, public)
	})

	return eg.Wait()
}

// identifyHandle identifies the canonical names in the given handle.
func identifyHandle(ctx context.Context, nug normalizedUsernameGetter, identifier identifier, h *TlfHandle) error {
	uids := append(h.ResolvedWriters(), h.ResolvedReaders()...)
	return identifyUserListForTLF(ctx, nug, identifier, uids, h.IsPublic())
}
