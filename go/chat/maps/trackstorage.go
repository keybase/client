package maps

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const diskTrackStorageVersion = 1

type diskLocationTrack struct {
	ConvID             chat1.ConversationID `codec:"C"`
	MsgID              chat1.MessageID      `codec:"M"`
	EndTime            gregor1.Time         `codec:"E"`
	Coords             []chat1.Coordinate   `codec:"O"`
	GetCurrentPosition bool                 `codec:"P"`
	MaxCoords          int                  `codec:"MC"`
	Stopped            bool                 `codec:"S"`
}

type diskTrackStorage struct {
	Version  int                 `codec:"V"`
	Trackers []diskLocationTrack `codec:"T"`
}

type trackStorage struct {
	globals.Contextified
	encryptedDB *encrypteddb.EncryptedDB
}

func newTrackStorage(g *globals.Context) *trackStorage {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG(), storage.DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &trackStorage{
		Contextified: globals.NewContextified(g),
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (t *trackStorage) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatLocation,
		Key: "tracks",
	}
}

func (t *trackStorage) Save(ctx context.Context, trackers []*locationTrack) error {
	var dat []diskLocationTrack
	for _, t := range trackers {
		dat = append(dat, t.ToDisk())
	}
	return t.encryptedDB.Put(ctx, t.dbKey(), diskTrackStorage{
		Version:  diskTrackStorageVersion,
		Trackers: dat,
	})
}

func (t *trackStorage) Restore(ctx context.Context) (res []*locationTrack, err error) {
	var dat diskTrackStorage
	found, err := t.encryptedDB.Get(ctx, t.dbKey(), &dat)
	if err != nil {
		return res, err
	}
	if !found {
		return nil, nil
	}
	if dat.Version != diskTrackStorageVersion {
		return nil, nil
	}
	for _, dt := range dat.Trackers {
		res = append(res, newLocationTrackFromDisk(dt))
	}
	return res, nil
}
