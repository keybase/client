package libkbfs

import (
	"os"
	"path"
	"strconv"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

const (
	// Where in config.StorageRoot() we store settings information.
	settingsDBDir           = "kbfs_settings"
	settingsDBVersionString = "v1"
	settingsDBName          = "kbfsSettings.leveldb"

	// Settings keys
	spaceAvailableNotificationThresholdKey = "spaceAvailableNotificationThreshold"
)

// ErrNoSettingsDB is returned when there is no settings DB potentially due to
// multiple concurrent KBFS instances.
var ErrNoSettingsDB = errors.New("no settings DB")

var errNoSession = errors.New("no session")

type currentSessionGetter interface {
	CurrentSessionGetter() idutil.CurrentSessionGetter
}

// SettingsDB stores KBFS user settings for a given device.
type SettingsDB struct {
	*LevelDb
	sessionGetter currentSessionGetter

	cache map[string][]byte
}

func openSettingsDBInternal(config Config) (*LevelDb, error) {
	if config.IsTestMode() {
		return openLevelDB(storage.NewMemStorage(), config.Mode())
	}
	dbPath := path.Join(config.StorageRoot(), settingsDBDir,
		settingsDBVersionString)
	err := os.MkdirAll(dbPath, os.ModePerm)
	if err != nil {
		return nil, err
	}

	stor, err := storage.OpenFile(path.Join(dbPath, settingsDBName), false)
	if err != nil {
		return nil, err
	}

	return openLevelDB(stor, config.Mode())
}

func openSettingsDB(config Config) *SettingsDB {
	db, err := openSettingsDBInternal(config)
	if err != nil {
		config.MakeLogger("SDB").CWarningf(context.Background(),
			"Could not open settings DB. "+
				"Perhaps multiple KBFS instances are being run concurrently"+
				"? Error: %+v", err)
		if db != nil {
			db.Close()
		}
		return nil
	}
	return &SettingsDB{
		LevelDb:       db,
		sessionGetter: config,
		cache:         make(map[string][]byte),
	}
}

func (db *SettingsDB) getUID(ctx context.Context) keybase1.UID {
	if db.sessionGetter == nil || db.sessionGetter.CurrentSessionGetter() == nil {
		return keybase1.UID("")
	}
	si, err := db.sessionGetter.CurrentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return keybase1.UID("")
	}
	return si.UID
}

func getSettingsDbKey(uid keybase1.UID, key string) []byte {
	return append([]byte(uid), []byte(key)...)
}

// Get overrides (*LevelDb).Get to cache values in memory.
func (db *SettingsDB) Get(key []byte, ro *opt.ReadOptions) ([]byte, error) {
	val, isCached := db.cache[string(key)]
	if isCached {
		return val, nil
	}
	val, err := db.LevelDb.Get(key, ro)
	if err == nil {
		db.cache[string(key)] = val
	}
	return val, err
}

// Put overrides (*LevelDb).Put to cache values in memory.
func (db *SettingsDB) Put(key []byte, val []byte, wo *opt.WriteOptions) error {
	err := db.LevelDb.Put(key, val, wo)
	if err != nil {
		delete(db.cache, string(key))
	} else {
		db.cache[string(key)] = val
	}
	return err
}

// Settings returns the logged-in user's settings as a keybase1.FSSettings.
func (db *SettingsDB) Settings(ctx context.Context) (keybase1.FSSettings, error) {
	uid := db.getUID(ctx)
	if uid == keybase1.UID("") {
		return keybase1.FSSettings{}, errNoSession
	}
	var notificationThreshold int64
	notificationThresholdBytes, err :=
		db.Get(getSettingsDbKey(uid, spaceAvailableNotificationThresholdKey), nil)
	if err == nil {
		notificationThreshold, _ =
			strconv.ParseInt(string(notificationThresholdBytes), 10, 64)
	}
	// If we have an error we just pretend there's an empty setting.
	return keybase1.FSSettings{
		SpaceAvailableNotificationThreshold: notificationThreshold,
	}, nil
}

// SetNotificationThreshold sets the notification threshold setting for the
// logged-in user.
func (db *SettingsDB) SetNotificationThreshold(
	ctx context.Context, threshold int64) error {
	uid := db.getUID(ctx)
	if uid == keybase1.UID("") {
		return errNoSession
	}
	return db.Put(getSettingsDbKey(uid, spaceAvailableNotificationThresholdKey),
		[]byte(strconv.FormatInt(threshold, 10)), nil)
}
