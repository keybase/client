package invitefriends

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func GetCounts(mctx libkb.MetaContext) (counts keybase1.InviteCounts, err error) {
	type apiRes struct {
		NumInvitesInLastDay int     `json:"numInvitesInLastDay"`
		PercentageChange    float64 `json:"percentageChange"`
		ShowNumInvites      bool    `json:"showNumInvites"`
		ShowFire            bool    `json:"showFire"`
		libkb.AppStatusEmbed
	}
	apiArg := libkb.APIArg{
		Endpoint:    "invite_friends/num_invites_in_last_day",
		SessionType: libkb.APISessionTypeNONE,
	}
	var res apiRes
	err = mctx.G().API.GetDecode(mctx, apiArg, &res)
	if err != nil {
		return counts, err
	}
	return keybase1.InviteCounts{
		InviteCount:      res.NumInvitesInLastDay,
		PercentageChange: res.PercentageChange,
		ShowNumInvites:   res.ShowNumInvites,
		ShowFire:         res.ShowFire,
	}, nil
}
