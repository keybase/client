// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kbfs.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type KBFSTeamSettings struct {
	TlfID TLFID `codec:"tlfID" json:"tlfID"`
}

func (o KBFSTeamSettings) DeepCopy() KBFSTeamSettings {
	return KBFSTeamSettings{
		TlfID: o.TlfID.DeepCopy(),
	}
}

type FSEventArg struct {
	Event FSNotification `codec:"event" json:"event"`
}

type FSPathUpdateArg struct {
	Path string `codec:"path" json:"path"`
}

type FSEditListArg struct {
	Edits     FSFolderEditHistory `codec:"edits" json:"edits"`
	RequestID int                 `codec:"requestID" json:"requestID"`
}

type FSSyncStatusArg struct {
	Status    FSSyncStatus `codec:"status" json:"status"`
	RequestID int          `codec:"requestID" json:"requestID"`
}

type FSSyncEventArg struct {
	Event FSPathSyncStatus `codec:"event" json:"event"`
}

type FSOverallSyncEventArg struct {
	Status FolderSyncStatus `codec:"status" json:"status"`
}

type FSOnlineStatusChangedEventArg struct {
	Online bool `codec:"online" json:"online"`
}

type FSFavoritesChangedEventArg struct {
}

type FSSubscriptionNotifyPathEventArg struct {
	ClientID        string                  `codec:"clientID" json:"clientID"`
	SubscriptionIDs []string                `codec:"subscriptionIDs" json:"subscriptionIDs"`
	Path            string                  `codec:"path" json:"path"`
	Topics          []PathSubscriptionTopic `codec:"topics" json:"topics"`
}

type FSSubscriptionNotifyEventArg struct {
	ClientID        string            `codec:"clientID" json:"clientID"`
	SubscriptionIDs []string          `codec:"subscriptionIDs" json:"subscriptionIDs"`
	Topic           SubscriptionTopic `codec:"topic" json:"topic"`
}

type CreateTLFArg struct {
	TeamID TeamID `codec:"teamID" json:"teamID"`
	TlfID  TLFID  `codec:"tlfID" json:"tlfID"`
}

type GetKBFSTeamSettingsArg struct {
	TeamID TeamID              `codec:"teamID" json:"teamID"`
	Oa     OfflineAvailability `codec:"oa" json:"oa"`
}

type UpgradeTLFArg struct {
	TlfName string `codec:"tlfName" json:"tlfName"`
	Public  bool   `codec:"public" json:"public"`
}

type EncryptFavoritesArg struct {
	DataToEncrypt []byte `codec:"dataToEncrypt" json:"dataToEncrypt"`
}

type DecryptFavoritesArg struct {
	DataToEncrypt []byte `codec:"dataToEncrypt" json:"dataToEncrypt"`
}

type KbfsInterface interface {
	// Idea is that kbfs would call the function below whenever these actions are
	// performed on a file.
	//
	// Note that this list/interface is very temporary and highly likely to change
	// significantly.
	//
	// It is just a starting point to get kbfs notifications through the daemon to
	// the clients.
	FSEvent(context.Context, FSNotification) error
	// kbfs calls this whenever the currently subscribed-to folder (via the
	// SimpleFSList[Recursive call) has been updated.
	FSPathUpdate(context.Context, string) error
	// kbfs calls this as a response to receiving an FSEditListRequest with a
	// given requestID.
	FSEditList(context.Context, FSEditListArg) error
	// FSSyncStatus is called by KBFS as a response to receiving an
	// FSSyncStatusRequest with a given requestID.
	FSSyncStatus(context.Context, FSSyncStatusArg) error
	// FSSyncEvent is called by KBFS when the sync status of an individual path
	// changes.
	FSSyncEvent(context.Context, FSPathSyncStatus) error
	// FSOverallSyncEvent is called by KBFS when the overall sync status
	// changes.
	FSOverallSyncEvent(context.Context, FolderSyncStatus) error
	// FSOnlineStatusChangedEvent is called by KBFS when the online status changes.
	FSOnlineStatusChangedEvent(context.Context, bool) error
	// FSFavoritesChangedEvent is called by KBFS when the favorites list changes.
	FSFavoritesChangedEvent(context.Context) error
	FSSubscriptionNotifyPathEvent(context.Context, FSSubscriptionNotifyPathEventArg) error
	FSSubscriptionNotifyEvent(context.Context, FSSubscriptionNotifyEventArg) error
	// createTLF is called by KBFS to associate the tlfID with the given teamID,
	// using the v2 Team-based system.
	CreateTLF(context.Context, CreateTLFArg) error
	// getKBFSTeamSettings gets the settings written for the team in the team's sigchain.
	GetKBFSTeamSettings(context.Context, GetKBFSTeamSettingsArg) (KBFSTeamSettings, error)
	// upgradeTLF upgrades a TLF to use implicit team keys
	UpgradeTLF(context.Context, UpgradeTLFArg) error
	// Encrypt cached favorites to store on disk.
	EncryptFavorites(context.Context, []byte) ([]byte, error)
	// Decrypt cached favorites stored on disk.
	DecryptFavorites(context.Context, []byte) ([]byte, error)
}

func KbfsProtocol(i KbfsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.kbfs",
		Methods: map[string]rpc.ServeHandlerDescription{
			"FSEvent": {
				MakeArg: func() interface{} {
					var ret [1]FSEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSEventArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSEventArg)(nil), args)
						return
					}
					err = i.FSEvent(ctx, typedArgs[0].Event)
					return
				},
			},
			"FSPathUpdate": {
				MakeArg: func() interface{} {
					var ret [1]FSPathUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSPathUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSPathUpdateArg)(nil), args)
						return
					}
					err = i.FSPathUpdate(ctx, typedArgs[0].Path)
					return
				},
			},
			"FSEditList": {
				MakeArg: func() interface{} {
					var ret [1]FSEditListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSEditListArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSEditListArg)(nil), args)
						return
					}
					err = i.FSEditList(ctx, typedArgs[0])
					return
				},
			},
			"FSSyncStatus": {
				MakeArg: func() interface{} {
					var ret [1]FSSyncStatusArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSyncStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSyncStatusArg)(nil), args)
						return
					}
					err = i.FSSyncStatus(ctx, typedArgs[0])
					return
				},
			},
			"FSSyncEvent": {
				MakeArg: func() interface{} {
					var ret [1]FSSyncEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSyncEventArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSyncEventArg)(nil), args)
						return
					}
					err = i.FSSyncEvent(ctx, typedArgs[0].Event)
					return
				},
			},
			"FSOverallSyncEvent": {
				MakeArg: func() interface{} {
					var ret [1]FSOverallSyncEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSOverallSyncEventArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSOverallSyncEventArg)(nil), args)
						return
					}
					err = i.FSOverallSyncEvent(ctx, typedArgs[0].Status)
					return
				},
			},
			"FSOnlineStatusChangedEvent": {
				MakeArg: func() interface{} {
					var ret [1]FSOnlineStatusChangedEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSOnlineStatusChangedEventArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSOnlineStatusChangedEventArg)(nil), args)
						return
					}
					err = i.FSOnlineStatusChangedEvent(ctx, typedArgs[0].Online)
					return
				},
			},
			"FSFavoritesChangedEvent": {
				MakeArg: func() interface{} {
					var ret [1]FSFavoritesChangedEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.FSFavoritesChangedEvent(ctx)
					return
				},
			},
			"FSSubscriptionNotifyPathEvent": {
				MakeArg: func() interface{} {
					var ret [1]FSSubscriptionNotifyPathEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSubscriptionNotifyPathEventArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSubscriptionNotifyPathEventArg)(nil), args)
						return
					}
					err = i.FSSubscriptionNotifyPathEvent(ctx, typedArgs[0])
					return
				},
			},
			"FSSubscriptionNotifyEvent": {
				MakeArg: func() interface{} {
					var ret [1]FSSubscriptionNotifyEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSubscriptionNotifyEventArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSubscriptionNotifyEventArg)(nil), args)
						return
					}
					err = i.FSSubscriptionNotifyEvent(ctx, typedArgs[0])
					return
				},
			},
			"createTLF": {
				MakeArg: func() interface{} {
					var ret [1]CreateTLFArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CreateTLFArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CreateTLFArg)(nil), args)
						return
					}
					err = i.CreateTLF(ctx, typedArgs[0])
					return
				},
			},
			"getKBFSTeamSettings": {
				MakeArg: func() interface{} {
					var ret [1]GetKBFSTeamSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetKBFSTeamSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetKBFSTeamSettingsArg)(nil), args)
						return
					}
					ret, err = i.GetKBFSTeamSettings(ctx, typedArgs[0])
					return
				},
			},
			"upgradeTLF": {
				MakeArg: func() interface{} {
					var ret [1]UpgradeTLFArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpgradeTLFArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpgradeTLFArg)(nil), args)
						return
					}
					err = i.UpgradeTLF(ctx, typedArgs[0])
					return
				},
			},
			"encryptFavorites": {
				MakeArg: func() interface{} {
					var ret [1]EncryptFavoritesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EncryptFavoritesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EncryptFavoritesArg)(nil), args)
						return
					}
					ret, err = i.EncryptFavorites(ctx, typedArgs[0].DataToEncrypt)
					return
				},
			},
			"decryptFavorites": {
				MakeArg: func() interface{} {
					var ret [1]DecryptFavoritesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DecryptFavoritesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DecryptFavoritesArg)(nil), args)
						return
					}
					ret, err = i.DecryptFavorites(ctx, typedArgs[0].DataToEncrypt)
					return
				},
			},
		},
	}
}

type KbfsClient struct {
	Cli rpc.GenericClient
}

// Idea is that kbfs would call the function below whenever these actions are
// performed on a file.
//
// Note that this list/interface is very temporary and highly likely to change
// significantly.
//
// It is just a starting point to get kbfs notifications through the daemon to
// the clients.
func (c KbfsClient) FSEvent(ctx context.Context, event FSNotification) (err error) {
	__arg := FSEventArg{Event: event}
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSEvent", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// kbfs calls this whenever the currently subscribed-to folder (via the
// SimpleFSList[Recursive call) has been updated.
func (c KbfsClient) FSPathUpdate(ctx context.Context, path string) (err error) {
	__arg := FSPathUpdateArg{Path: path}
	err = c.Cli.Notify(ctx, "keybase.1.kbfs.FSPathUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}

// kbfs calls this as a response to receiving an FSEditListRequest with a
// given requestID.
func (c KbfsClient) FSEditList(ctx context.Context, __arg FSEditListArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSEditList", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// FSSyncStatus is called by KBFS as a response to receiving an
// FSSyncStatusRequest with a given requestID.
func (c KbfsClient) FSSyncStatus(ctx context.Context, __arg FSSyncStatusArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSSyncStatus", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// FSSyncEvent is called by KBFS when the sync status of an individual path
// changes.
func (c KbfsClient) FSSyncEvent(ctx context.Context, event FSPathSyncStatus) (err error) {
	__arg := FSSyncEventArg{Event: event}
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSSyncEvent", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// FSOverallSyncEvent is called by KBFS when the overall sync status
// changes.
func (c KbfsClient) FSOverallSyncEvent(ctx context.Context, status FolderSyncStatus) (err error) {
	__arg := FSOverallSyncEventArg{Status: status}
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSOverallSyncEvent", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// FSOnlineStatusChangedEvent is called by KBFS when the online status changes.
func (c KbfsClient) FSOnlineStatusChangedEvent(ctx context.Context, online bool) (err error) {
	__arg := FSOnlineStatusChangedEventArg{Online: online}
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSOnlineStatusChangedEvent", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// FSFavoritesChangedEvent is called by KBFS when the favorites list changes.
func (c KbfsClient) FSFavoritesChangedEvent(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSFavoritesChangedEvent", []interface{}{FSFavoritesChangedEventArg{}}, nil, 0*time.Millisecond)
	return
}

func (c KbfsClient) FSSubscriptionNotifyPathEvent(ctx context.Context, __arg FSSubscriptionNotifyPathEventArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSSubscriptionNotifyPathEvent", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c KbfsClient) FSSubscriptionNotifyEvent(ctx context.Context, __arg FSSubscriptionNotifyEventArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSSubscriptionNotifyEvent", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// createTLF is called by KBFS to associate the tlfID with the given teamID,
// using the v2 Team-based system.
func (c KbfsClient) CreateTLF(ctx context.Context, __arg CreateTLFArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfs.createTLF", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// getKBFSTeamSettings gets the settings written for the team in the team's sigchain.
func (c KbfsClient) GetKBFSTeamSettings(ctx context.Context, __arg GetKBFSTeamSettingsArg) (res KBFSTeamSettings, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfs.getKBFSTeamSettings", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// upgradeTLF upgrades a TLF to use implicit team keys
func (c KbfsClient) UpgradeTLF(ctx context.Context, __arg UpgradeTLFArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfs.upgradeTLF", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Encrypt cached favorites to store on disk.
func (c KbfsClient) EncryptFavorites(ctx context.Context, dataToEncrypt []byte) (res []byte, err error) {
	__arg := EncryptFavoritesArg{DataToEncrypt: dataToEncrypt}
	err = c.Cli.Call(ctx, "keybase.1.kbfs.encryptFavorites", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Decrypt cached favorites stored on disk.
func (c KbfsClient) DecryptFavorites(ctx context.Context, dataToEncrypt []byte) (res []byte, err error) {
	__arg := DecryptFavoritesArg{DataToEncrypt: dataToEncrypt}
	err = c.Cli.Call(ctx, "keybase.1.kbfs.decryptFavorites", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
