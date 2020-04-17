package invitefriends

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

var (
	countsCache   *keybase1.InviteCounts
	countsCacheMu sync.Mutex // mutex isn't rw due to low call frequency
)

func GetCounts(mctx libkb.MetaContext) (counts keybase1.InviteCounts, err error) {
	type apiRes struct {
		NumInvites       int     `json:"numInvites"`
		PercentageChange float64 `json:"percentageChange"`
		ShowNumInvites   bool    `json:"showNumInvites"`
		ShowFire         bool    `json:"showFire"`
		TooltipMarkdown  string  `json:"tooltipMarkdown"`
		libkb.AppStatusEmbed
	}
	apiArg := libkb.APIArg{
		Endpoint:    "invite_friends/num_invites",
		SessionType: libkb.APISessionTypeNONE,
	}
	var res apiRes
	err = mctx.G().API.GetDecode(mctx, apiArg, &res)
	if err != nil {
		return counts, err
	}
	newCounts := keybase1.InviteCounts{
		InviteCount:      res.NumInvites,
		PercentageChange: res.PercentageChange,
		ShowNumInvites:   res.ShowNumInvites,
		ShowFire:         res.ShowFire,
		TooltipMarkdown:  res.TooltipMarkdown,
	}
	countsCacheMu.Lock()
	countsCache = &newCounts
	countsCacheMu.Unlock()
	return newCounts, nil
}

func RequestNotification(mctx libkb.MetaContext) error {
	// noop if there's no home ui present
	if ui, err := mctx.G().UIRouter.GetHomeUI(); ui == nil || err != nil {
		return nil
	}

	// we only need to grab the pointer during the lock
	countsCacheMu.Lock()
	counts := countsCache
	countsCacheMu.Unlock()

	if counts == nil {
		freshCounts, err := GetCounts(mctx)
		if err != nil {
			return err
		}
		counts = &freshCounts
	}
	mctx.G().NotifyRouter.HandleUpdateInviteCounts(mctx.Ctx(), *counts)
	return nil
}
