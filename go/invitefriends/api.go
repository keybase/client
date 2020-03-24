package invitefriends

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func GetCounts(mctx libkb.MetaContext) (counts keybase1.InviteCounts, err error) {
	type apiRes struct {
		numInvitesInLastDay int
		percentageChange    float64
		showNumInvites      bool
		showFire            bool
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
		InviteCount:      res.numInvitesInLastDay,
		PercentageChange: res.percentageChange,
		ShowNumInvites:   res.showNumInvites,
		ShowFire:         res.showFire,
	}, nil
}
