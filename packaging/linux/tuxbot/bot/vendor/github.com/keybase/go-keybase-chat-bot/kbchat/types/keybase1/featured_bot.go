// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/featured_bot.avdl

package keybase1

type FeaturedBot struct {
	BotAlias            string  `codec:"botAlias" json:"botAlias"`
	Description         string  `codec:"description" json:"description"`
	ExtendedDescription string  `codec:"extendedDescription" json:"extendedDescription"`
	BotUsername         string  `codec:"botUsername" json:"botUsername"`
	OwnerTeam           *string `codec:"ownerTeam,omitempty" json:"ownerTeam,omitempty"`
	OwnerUser           *string `codec:"ownerUser,omitempty" json:"ownerUser,omitempty"`
	Rank                int     `codec:"rank" json:"rank"`
	IsPromoted          bool    `codec:"isPromoted" json:"isPromoted"`
}

func (o FeaturedBot) DeepCopy() FeaturedBot {
	return FeaturedBot{
		BotAlias:            o.BotAlias,
		Description:         o.Description,
		ExtendedDescription: o.ExtendedDescription,
		BotUsername:         o.BotUsername,
		OwnerTeam: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.OwnerTeam),
		OwnerUser: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.OwnerUser),
		Rank:       o.Rank,
		IsPromoted: o.IsPromoted,
	}
}

type FeaturedBotsRes struct {
	Bots       []FeaturedBot `codec:"bots" json:"bots"`
	IsLastPage bool          `codec:"isLastPage" json:"isLastPage"`
}

func (o FeaturedBotsRes) DeepCopy() FeaturedBotsRes {
	return FeaturedBotsRes{
		Bots: (func(x []FeaturedBot) []FeaturedBot {
			if x == nil {
				return nil
			}
			ret := make([]FeaturedBot, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Bots),
		IsLastPage: o.IsLastPage,
	}
}

type SearchRes struct {
	Bots       []FeaturedBot `codec:"bots" json:"bots"`
	IsLastPage bool          `codec:"isLastPage" json:"isLastPage"`
}

func (o SearchRes) DeepCopy() SearchRes {
	return SearchRes{
		Bots: (func(x []FeaturedBot) []FeaturedBot {
			if x == nil {
				return nil
			}
			ret := make([]FeaturedBot, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Bots),
		IsLastPage: o.IsLastPage,
	}
}
