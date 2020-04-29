// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_fs.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type FSActivityArg struct {
	Notification FSNotification `codec:"notification" json:"notification"`
}

type FSPathUpdatedArg struct {
	Path string `codec:"path" json:"path"`
}

type FSSyncActivityArg struct {
	Status FSPathSyncStatus `codec:"status" json:"status"`
}

type FSEditListResponseArg struct {
	Edits     FSFolderEditHistory `codec:"edits" json:"edits"`
	RequestID int                 `codec:"requestID" json:"requestID"`
}

type FSSyncStatusResponseArg struct {
	Status    FSSyncStatus `codec:"status" json:"status"`
	RequestID int          `codec:"requestID" json:"requestID"`
}

type FSOverallSyncStatusChangedArg struct {
	Status FolderSyncStatus `codec:"status" json:"status"`
}

type FSFavoritesChangedArg struct {
}

type FSOnlineStatusChangedArg struct {
	Online bool `codec:"online" json:"online"`
}

type FSSubscriptionNotifyPathArg struct {
	ClientID        string                  `codec:"clientID" json:"clientID"`
	SubscriptionIDs []string                `codec:"subscriptionIDs" json:"subscriptionIDs"`
	Path            string                  `codec:"path" json:"path"`
	Topics          []PathSubscriptionTopic `codec:"topics" json:"topics"`
}

type FSSubscriptionNotifyArg struct {
	ClientID        string            `codec:"clientID" json:"clientID"`
	SubscriptionIDs []string          `codec:"subscriptionIDs" json:"subscriptionIDs"`
	Topic           SubscriptionTopic `codec:"topic" json:"topic"`
}

type NotifyFSInterface interface {
	FSActivity(context.Context, FSNotification) error
	FSPathUpdated(context.Context, string) error
	FSSyncActivity(context.Context, FSPathSyncStatus) error
	FSEditListResponse(context.Context, FSEditListResponseArg) error
	FSSyncStatusResponse(context.Context, FSSyncStatusResponseArg) error
	FSOverallSyncStatusChanged(context.Context, FolderSyncStatus) error
	FSFavoritesChanged(context.Context) error
	FSOnlineStatusChanged(context.Context, bool) error
	FSSubscriptionNotifyPath(context.Context, FSSubscriptionNotifyPathArg) error
	FSSubscriptionNotify(context.Context, FSSubscriptionNotifyArg) error
}

func NotifyFSProtocol(i NotifyFSInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyFS",
		Methods: map[string]rpc.ServeHandlerDescription{
			"FSActivity": {
				MakeArg: func() interface{} {
					var ret [1]FSActivityArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSActivityArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSActivityArg)(nil), args)
						return
					}
					err = i.FSActivity(ctx, typedArgs[0].Notification)
					return
				},
			},
			"FSPathUpdated": {
				MakeArg: func() interface{} {
					var ret [1]FSPathUpdatedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSPathUpdatedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSPathUpdatedArg)(nil), args)
						return
					}
					err = i.FSPathUpdated(ctx, typedArgs[0].Path)
					return
				},
			},
			"FSSyncActivity": {
				MakeArg: func() interface{} {
					var ret [1]FSSyncActivityArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSyncActivityArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSyncActivityArg)(nil), args)
						return
					}
					err = i.FSSyncActivity(ctx, typedArgs[0].Status)
					return
				},
			},
			"FSEditListResponse": {
				MakeArg: func() interface{} {
					var ret [1]FSEditListResponseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSEditListResponseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSEditListResponseArg)(nil), args)
						return
					}
					err = i.FSEditListResponse(ctx, typedArgs[0])
					return
				},
			},
			"FSSyncStatusResponse": {
				MakeArg: func() interface{} {
					var ret [1]FSSyncStatusResponseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSyncStatusResponseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSyncStatusResponseArg)(nil), args)
						return
					}
					err = i.FSSyncStatusResponse(ctx, typedArgs[0])
					return
				},
			},
			"FSOverallSyncStatusChanged": {
				MakeArg: func() interface{} {
					var ret [1]FSOverallSyncStatusChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSOverallSyncStatusChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSOverallSyncStatusChangedArg)(nil), args)
						return
					}
					err = i.FSOverallSyncStatusChanged(ctx, typedArgs[0].Status)
					return
				},
			},
			"FSFavoritesChanged": {
				MakeArg: func() interface{} {
					var ret [1]FSFavoritesChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.FSFavoritesChanged(ctx)
					return
				},
			},
			"FSOnlineStatusChanged": {
				MakeArg: func() interface{} {
					var ret [1]FSOnlineStatusChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSOnlineStatusChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSOnlineStatusChangedArg)(nil), args)
						return
					}
					err = i.FSOnlineStatusChanged(ctx, typedArgs[0].Online)
					return
				},
			},
			"FSSubscriptionNotifyPath": {
				MakeArg: func() interface{} {
					var ret [1]FSSubscriptionNotifyPathArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSubscriptionNotifyPathArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSubscriptionNotifyPathArg)(nil), args)
						return
					}
					err = i.FSSubscriptionNotifyPath(ctx, typedArgs[0])
					return
				},
			},
			"FSSubscriptionNotify": {
				MakeArg: func() interface{} {
					var ret [1]FSSubscriptionNotifyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSubscriptionNotifyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSubscriptionNotifyArg)(nil), args)
						return
					}
					err = i.FSSubscriptionNotify(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyFSClient struct {
	Cli rpc.GenericClient
}

func (c NotifyFSClient) FSActivity(ctx context.Context, notification FSNotification) (err error) {
	__arg := FSActivityArg{Notification: notification}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSActivity", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSPathUpdated(ctx context.Context, path string) (err error) {
	__arg := FSPathUpdatedArg{Path: path}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSPathUpdated", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSSyncActivity(ctx context.Context, status FSPathSyncStatus) (err error) {
	__arg := FSSyncActivityArg{Status: status}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSSyncActivity", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSEditListResponse(ctx context.Context, __arg FSEditListResponseArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSEditListResponse", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSSyncStatusResponse(ctx context.Context, __arg FSSyncStatusResponseArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSSyncStatusResponse", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSOverallSyncStatusChanged(ctx context.Context, status FolderSyncStatus) (err error) {
	__arg := FSOverallSyncStatusChangedArg{Status: status}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSOverallSyncStatusChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSFavoritesChanged(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSFavoritesChanged", []interface{}{FSFavoritesChangedArg{}}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSOnlineStatusChanged(ctx context.Context, online bool) (err error) {
	__arg := FSOnlineStatusChangedArg{Online: online}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSOnlineStatusChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSSubscriptionNotifyPath(ctx context.Context, __arg FSSubscriptionNotifyPathArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSSubscriptionNotifyPath", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSClient) FSSubscriptionNotify(ctx context.Context, __arg FSSubscriptionNotifyArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSSubscriptionNotify", []interface{}{__arg}, 0*time.Millisecond)
	return
}
