// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type card struct {
	Status        libkb.AppStatus `json:"status"`
	FollowSummary struct {
		Following int `json:"following"`
		Followers int `json:"followers"`
	} `json:"follow_summary"`
	Profile struct {
		FullName string `json:"full_name"`
		Location string `json:"location"`
		Bio      string `json:"bio"`
		Website  string `json:"website"`
		Twitter  string `json:"twitter"`
	} `json:"profile"`
	YouFollowThem bool `json:"you_follow_them"`
	TheyFollowYou bool `json:"they_follow_you"`
}

func (c *card) GetAppStatus() *libkb.AppStatus {
	return &c.Status
}

func getUserCard(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID, useSession bool) (ret *keybase1.UserCard, err error) {
	defer g.CTrace(ctx, "getUserCard", func() error { return err })()

	cached, err := g.CardCache.Get(uid, useSession)
	if err != nil {
		g.Log.CDebugf(ctx, "CardCache.Get error: %s", err)
	} else if cached != nil {
		g.Log.CDebugf(ctx, "CardCache.Get hit for %s", uid)
		return cached, nil
	}
	g.Log.CDebugf(ctx, "CardCache.Get miss for %s", uid)

	sessionType := libkb.APISessionTypeNONE
	if useSession {
		sessionType = libkb.APISessionTypeREQUIRED
	}
	arg := libkb.APIArg{
		Endpoint:    "user/card",
		SessionType: sessionType,
		Args:        libkb.HTTPArgs{"uid": libkb.S{Val: uid.String()}},
		NetContext:  ctx,
	}

	var card card

	if err = g.API.GetDecode(arg, &card); err != nil {
		g.Log.CWarningf(ctx, "error getting user/card for %s: %s\n", uid, err)
		return nil, err
	}

	ret = &keybase1.UserCard{
		Following:     card.FollowSummary.Following,
		Followers:     card.FollowSummary.Followers,
		Uid:           uid,
		FullName:      card.Profile.FullName,
		Location:      card.Profile.Location,
		Bio:           card.Profile.Bio,
		Website:       card.Profile.Website,
		Twitter:       card.Profile.Twitter,
		YouFollowThem: card.YouFollowThem,
		TheyFollowYou: card.TheyFollowYou,
	}

	if err := g.CardCache.Set(ret, useSession); err != nil {
		g.Log.CDebugf(ctx, "CardCache.Set error: %s", err)
	}

	return ret, nil
}

func displayUserCard(ctx context.Context, g *libkb.GlobalContext, iui libkb.IdentifyUI, uid keybase1.UID, useSession bool) error {
	card, err := getUserCard(ctx, g, uid, useSession)
	if err != nil {
		return err
	}
	if card == nil {
		return nil
	}

	return iui.DisplayUserCard(*card)
}

func displayUserCardAsync(ctx context.Context, g *libkb.GlobalContext, iui libkb.IdentifyUI, uid keybase1.UID, useSession bool) <-chan error {
	ch := make(chan error)
	go func() {
		ch <- displayUserCard(ctx, g, iui, uid, useSession)
	}()
	return ch
}

func GetFullName(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (string, error) {
	card, err := getUserCard(ctx, g, uid, false)
	if err != nil {
		return "", err
	}
	if card == nil {
		return "", nil
	}
	return card.FullName, nil
}
