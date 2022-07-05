// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_ctl.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type NotificationChannels struct {
	Session              bool `codec:"session" json:"session"`
	Users                bool `codec:"users" json:"users"`
	Kbfs                 bool `codec:"kbfs" json:"kbfs"`
	Kbfsdesktop          bool `codec:"kbfsdesktop" json:"kbfsdesktop"`
	Kbfslegacy           bool `codec:"kbfslegacy" json:"kbfslegacy"`
	Kbfssubscription     bool `codec:"kbfssubscription" json:"kbfssubscription"`
	Tracking             bool `codec:"tracking" json:"tracking"`
	Favorites            bool `codec:"favorites" json:"favorites"`
	Paperkeys            bool `codec:"paperkeys" json:"paperkeys"`
	Keyfamily            bool `codec:"keyfamily" json:"keyfamily"`
	Service              bool `codec:"service" json:"service"`
	App                  bool `codec:"app" json:"app"`
	Chat                 bool `codec:"chat" json:"chat"`
	PGP                  bool `codec:"pgp" json:"pgp"`
	Kbfsrequest          bool `codec:"kbfsrequest" json:"kbfsrequest"`
	Badges               bool `codec:"badges" json:"badges"`
	Reachability         bool `codec:"reachability" json:"reachability"`
	Team                 bool `codec:"team" json:"team"`
	Ephemeral            bool `codec:"ephemeral" json:"ephemeral"`
	Teambot              bool `codec:"teambot" json:"teambot"`
	Chatkbfsedits        bool `codec:"chatkbfsedits" json:"chatkbfsedits"`
	Chatdev              bool `codec:"chatdev" json:"chatdev"`
	Chatemoji            bool `codec:"chatemoji" json:"chatemoji"`
	Chatemojicross       bool `codec:"chatemojicross" json:"chatemojicross"`
	Deviceclone          bool `codec:"deviceclone" json:"deviceclone"`
	Chatattachments      bool `codec:"chatattachments" json:"chatattachments"`
	Wallet               bool `codec:"wallet" json:"wallet"`
	Audit                bool `codec:"audit" json:"audit"`
	Runtimestats         bool `codec:"runtimestats" json:"runtimestats"`
	FeaturedBots         bool `codec:"featuredBots" json:"featuredBots"`
	Saltpack             bool `codec:"saltpack" json:"saltpack"`
	AllowChatNotifySkips bool `codec:"allowChatNotifySkips" json:"allowChatNotifySkips"`
}

func (o NotificationChannels) DeepCopy() NotificationChannels {
	return NotificationChannels{
		Session:              o.Session,
		Users:                o.Users,
		Kbfs:                 o.Kbfs,
		Kbfsdesktop:          o.Kbfsdesktop,
		Kbfslegacy:           o.Kbfslegacy,
		Kbfssubscription:     o.Kbfssubscription,
		Tracking:             o.Tracking,
		Favorites:            o.Favorites,
		Paperkeys:            o.Paperkeys,
		Keyfamily:            o.Keyfamily,
		Service:              o.Service,
		App:                  o.App,
		Chat:                 o.Chat,
		PGP:                  o.PGP,
		Kbfsrequest:          o.Kbfsrequest,
		Badges:               o.Badges,
		Reachability:         o.Reachability,
		Team:                 o.Team,
		Ephemeral:            o.Ephemeral,
		Teambot:              o.Teambot,
		Chatkbfsedits:        o.Chatkbfsedits,
		Chatdev:              o.Chatdev,
		Chatemoji:            o.Chatemoji,
		Chatemojicross:       o.Chatemojicross,
		Deviceclone:          o.Deviceclone,
		Chatattachments:      o.Chatattachments,
		Wallet:               o.Wallet,
		Audit:                o.Audit,
		Runtimestats:         o.Runtimestats,
		FeaturedBots:         o.FeaturedBots,
		Saltpack:             o.Saltpack,
		AllowChatNotifySkips: o.AllowChatNotifySkips,
	}
}

type SetNotificationsArg struct {
	Channels NotificationChannels `codec:"channels" json:"channels"`
}

type NotifyCtlInterface interface {
	SetNotifications(context.Context, NotificationChannels) error
}

func NotifyCtlProtocol(i NotifyCtlInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.notifyCtl",
		Methods: map[string]rpc.ServeHandlerDescription{
			"setNotifications": {
				MakeArg: func() interface{} {
					var ret [1]SetNotificationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetNotificationsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetNotificationsArg)(nil), args)
						return
					}
					err = i.SetNotifications(ctx, typedArgs[0].Channels)
					return
				},
			},
		},
	}
}

type NotifyCtlClient struct {
	Cli rpc.GenericClient
}

func (c NotifyCtlClient) SetNotifications(ctx context.Context, channels NotificationChannels) (err error) {
	__arg := SetNotificationsArg{Channels: channels}
	err = c.Cli.Call(ctx, "keybase.1.notifyCtl.setNotifications", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
