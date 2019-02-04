// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
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
	YouFollowThem        bool                        `json:"you_follow_them"`
	TheyFollowYou        bool                        `json:"they_follow_you"`
	TeamShowcase         []keybase1.UserTeamShowcase `json:"team_showcase"`
	RegisteredForAirdrop bool                        `json:"airdrop_registered"`
}

func (c *card) GetAppStatus() *libkb.AppStatus {
	return &c.Status
}

func getUserCard(m libkb.MetaContext, uid keybase1.UID, useSession bool) (ret *keybase1.UserCard, err error) {
	defer m.CTrace("getUserCard", func() error { return err })()

	cached, err := m.G().CardCache().Get(uid, useSession)
	if err != nil {
		m.CDebugf("CardCache.Get error: %s", err)
	} else if cached != nil {
		m.CDebugf("CardCache.Get hit for %s", uid)
		return cached, nil
	}
	m.CDebugf("CardCache.Get miss for %s", uid)

	sessionType := libkb.APISessionTypeNONE
	if useSession {
		sessionType = libkb.APISessionTypeREQUIRED
	}
	arg := libkb.APIArg{
		Endpoint:    "user/card",
		SessionType: sessionType,
		Args:        libkb.HTTPArgs{"uid": libkb.S{Val: uid.String()}},
		NetContext:  m.Ctx(),
	}

	var card card

	if err = m.G().API.GetDecode(arg, &card); err != nil {
		m.CWarningf("error getting user/card for %s: %s\n", uid, err)
		return nil, err
	}

	ret = &keybase1.UserCard{
		Following:            card.FollowSummary.Following,
		Followers:            card.FollowSummary.Followers,
		Uid:                  uid,
		FullName:             card.Profile.FullName,
		Location:             card.Profile.Location,
		Bio:                  card.Profile.Bio,
		Website:              card.Profile.Website,
		Twitter:              card.Profile.Twitter,
		YouFollowThem:        card.YouFollowThem,
		TheyFollowYou:        card.TheyFollowYou,
		TeamShowcase:         card.TeamShowcase,
		RegisteredForAirdrop: card.RegisteredForAirdrop,
	}

	if err := m.G().CardCache().Set(ret, useSession); err != nil {
		m.CDebugf("CardCache.Set error: %s", err)
	}

	return ret, nil
}

func displayUserCard(m libkb.MetaContext, uid keybase1.UID, useSession bool) error {
	card, err := getUserCard(m, uid, useSession)
	if err != nil {
		return err
	}
	if card == nil {
		return nil
	}

	return m.UIs().IdentifyUI.DisplayUserCard(*card)
}

func displayUserCardAsync(m libkb.MetaContext, uid keybase1.UID, useSession bool) <-chan error {
	ch := make(chan error)
	go func() {
		ch <- displayUserCard(m, uid, useSession)
	}()
	return ch
}

func GetFullName(m libkb.MetaContext, uid keybase1.UID) (string, error) {
	card, err := getUserCard(m, uid, false)
	if err != nil {
		return "", err
	}
	if card == nil {
		return "", nil
	}
	return card.FullName, nil
}
