package libkb

import (
	"github.com/keybase/client/go/protocol/keybase1"
)

type card struct {
	Status        AppStatus `json:"status"`
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
	Blocked              bool                        `json:"blocked"`
}

func (c *card) GetAppStatus() *AppStatus {
	return &c.Status
}

func UserCard(m MetaContext, uid keybase1.UID, useSession bool) (ret *keybase1.UserCard, err error) {
	defer m.Trace("UserCard", func() error { return err })()

	cached, err := m.G().CardCache().Get(uid, useSession)
	if err != nil {
		m.Debug("CardCache.Get error: %s", err)
	} else if cached != nil {
		m.Debug("CardCache.Get hit for %s", uid)
		return cached, nil
	}
	m.Debug("CardCache.Get miss for %s", uid)

	sessionType := APISessionTypeNONE
	if useSession {
		sessionType = APISessionTypeREQUIRED
	}
	arg := APIArg{
		Endpoint:    "user/card",
		SessionType: sessionType,
		Args:        HTTPArgs{"uid": S{Val: uid.String()}},
	}

	var card card

	if err = m.G().API.GetDecode(m, arg, &card); err != nil {
		m.Warning("error getting user/card for %s: %s\n", uid, err)
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
		Blocked:              card.Blocked,
	}

	if err := m.G().CardCache().Set(ret, useSession); err != nil {
		m.Debug("CardCache.Set error: %s", err)
	}

	return ret, nil
}

func displayUserCard(m MetaContext, uid keybase1.UID, useSession bool) error {
	card, err := UserCard(m, uid, useSession)
	if err != nil {
		return err
	}
	if card == nil {
		return nil
	}

	return m.UIs().IdentifyUI.DisplayUserCard(m, *card)
}

func DisplayUserCardAsync(m MetaContext, uid keybase1.UID, useSession bool) <-chan error {
	ch := make(chan error)
	go func() {
		ch <- displayUserCard(m, uid, useSession)
	}()
	return ch
}

func GetFullName(m MetaContext, uid keybase1.UID) (string, error) {
	card, err := UserCard(m, uid, false)
	if err != nil {
		return "", err
	}
	if card == nil {
		return "", nil
	}
	return card.FullName, nil
}
