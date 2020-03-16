// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/notify_ctl.avdl

package keybase1

type NotificationChannels struct {
	Session          bool `codec:"session" json:"session"`
	Users            bool `codec:"users" json:"users"`
	Kbfs             bool `codec:"kbfs" json:"kbfs"`
	Kbfsdesktop      bool `codec:"kbfsdesktop" json:"kbfsdesktop"`
	Kbfslegacy       bool `codec:"kbfslegacy" json:"kbfslegacy"`
	Kbfssubscription bool `codec:"kbfssubscription" json:"kbfssubscription"`
	Tracking         bool `codec:"tracking" json:"tracking"`
	Favorites        bool `codec:"favorites" json:"favorites"`
	Paperkeys        bool `codec:"paperkeys" json:"paperkeys"`
	Keyfamily        bool `codec:"keyfamily" json:"keyfamily"`
	Service          bool `codec:"service" json:"service"`
	App              bool `codec:"app" json:"app"`
	Chat             bool `codec:"chat" json:"chat"`
	PGP              bool `codec:"pgp" json:"pgp"`
	Kbfsrequest      bool `codec:"kbfsrequest" json:"kbfsrequest"`
	Badges           bool `codec:"badges" json:"badges"`
	Reachability     bool `codec:"reachability" json:"reachability"`
	Team             bool `codec:"team" json:"team"`
	Ephemeral        bool `codec:"ephemeral" json:"ephemeral"`
	Teambot          bool `codec:"teambot" json:"teambot"`
	Chatkbfsedits    bool `codec:"chatkbfsedits" json:"chatkbfsedits"`
	Chatdev          bool `codec:"chatdev" json:"chatdev"`
	Deviceclone      bool `codec:"deviceclone" json:"deviceclone"`
	Chatattachments  bool `codec:"chatattachments" json:"chatattachments"`
	Wallet           bool `codec:"wallet" json:"wallet"`
	Audit            bool `codec:"audit" json:"audit"`
	Runtimestats     bool `codec:"runtimestats" json:"runtimestats"`
	FeaturedBots     bool `codec:"featuredBots" json:"featuredBots"`
	Saltpack         bool `codec:"saltpack" json:"saltpack"`
}

func (o NotificationChannels) DeepCopy() NotificationChannels {
	return NotificationChannels{
		Session:          o.Session,
		Users:            o.Users,
		Kbfs:             o.Kbfs,
		Kbfsdesktop:      o.Kbfsdesktop,
		Kbfslegacy:       o.Kbfslegacy,
		Kbfssubscription: o.Kbfssubscription,
		Tracking:         o.Tracking,
		Favorites:        o.Favorites,
		Paperkeys:        o.Paperkeys,
		Keyfamily:        o.Keyfamily,
		Service:          o.Service,
		App:              o.App,
		Chat:             o.Chat,
		PGP:              o.PGP,
		Kbfsrequest:      o.Kbfsrequest,
		Badges:           o.Badges,
		Reachability:     o.Reachability,
		Team:             o.Team,
		Ephemeral:        o.Ephemeral,
		Teambot:          o.Teambot,
		Chatkbfsedits:    o.Chatkbfsedits,
		Chatdev:          o.Chatdev,
		Deviceclone:      o.Deviceclone,
		Chatattachments:  o.Chatattachments,
		Wallet:           o.Wallet,
		Audit:            o.Audit,
		Runtimestats:     o.Runtimestats,
		FeaturedBots:     o.FeaturedBots,
		Saltpack:         o.Saltpack,
	}
}
