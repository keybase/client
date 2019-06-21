package maps

import (
	"context"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type diskLocationTrack struct {
	ConvID             chat1.ConversationID `codec:"C"`
	MsgID              chat1.MessageID      `codec:"M"`
	EndTime            time.Time            `codec:"E"`
	Coords             []chat1.Coordinate   `codec:"O"`
	GetCurrentPosition bool                 `codec:"P"`
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
		dat = append(dat, t.toDisk())
	}
	return t.encryptedDB.Put(ctx, t.dbKey(), dat)
}

func (t *trackStorage) Restore(ctx context.Context) (res []*locationTrack, err error) {
	var dat []diskLocationTrack
	found, err := t.encryptedDB.Get(ctx, t.dbKey(), dat)
	if err != nil {
		return res, err
	}
	if !found {
		return nil, nil
	}
	for _, dt := range dat {
		res = append(res, newLocationTrackFromDisk(dt))
	}
	return res, nil
}
