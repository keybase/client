// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/featured_bot.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type FeaturedBot struct {
	BotAlias    string  `codec:"botAlias" json:"bot_alias"`
	Description string  `codec:"description" json:"description"`
	BotUsername string  `codec:"botUsername" json:"bot_username"`
	OwnerTeamID *TeamID `codec:"ownerTeamID,omitempty" json:"owner_team_id,omitempty"`
	OwnerUID    *UID    `codec:"ownerUID,omitempty" json:"owner_uid,omitempty"`
}

func (o FeaturedBot) DeepCopy() FeaturedBot {
	return FeaturedBot{
		BotAlias:    o.BotAlias,
		Description: o.Description,
		BotUsername: o.BotUsername,
		OwnerTeamID: (func(x *TeamID) *TeamID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OwnerTeamID),
		OwnerUID: (func(x *UID) *UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OwnerUID),
	}
}

type FeaturedbotInterface interface {
}

func FeaturedbotProtocol(i FeaturedbotInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.featuredbot",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type FeaturedbotClient struct {
	Cli rpc.GenericClient
}
