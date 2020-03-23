package libkbfs

import (
	"os"
	"path"
	"strconv"
	"sync"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/ldbutils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb"
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

	sfmiBannerDismissedKey = "sfmiBannerDismissed"
	syncOnCellularKey      = "syncOnCellular"
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
	*ldbutils.LevelDb
	sessionGetter currentSessionGetter
	logger        logger.Logger
	vlogger       *libkb.VDebugLog

	lock  sync.RWMutex
	cache map[string][]byte
}

func openSettingsDBInternal(config Config) (*ldbutils.LevelDb, error) {
	if config.IsTestMode() {
		return ldbutils.OpenLevelDb(storage.NewMemStorage(), config.Mode())
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

	return ldbutils.OpenLevelDb(stor, config.Mode())
}

func openSettingsDB(config Config) *SettingsDB {
	logger := config.MakeLogger("SDB")
	vlogger := config.MakeVLogger(logger)
	db, err := openSettingsDBInternal(config)
	if err != nil {
		logger.CWarningf(context.Background(),
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
		logger:        logger,
		vlogger:       vlogger,
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

func (db *SettingsDB) getFromCache(key string) (val []byte, isCached bool) {
	db.lock.RLock()
	defer db.lock.RUnlock()
	val, isCached = db.cache[key]
	return val, isCached
}

func (db *SettingsDB) updateCache(key string, val []byte) {
	db.lock.Lock()
	defer db.lock.Unlock()
	if val == nil {
		delete(db.cache, key)
	} else {
		db.cache[key] = val
	}
}

// Get overrides (*LevelDb).Get to cache values in memory.
func (db *SettingsDB) Get(key []byte, ro *opt.ReadOptions) ([]byte, error) {
	val, isCached := db.getFromCache(string(key))
	if isCached {
		return val, nil
	}
	val, err := db.LevelDb.Get(key, ro)
	if err == nil {
		db.updateCache(string(key), val)
	}
	return val, err
}

// Put overrides (*LevelDb).Put to cache values in memory.
func (db *SettingsDB) Put(key []byte, val []byte, wo *opt.WriteOptions) error {
	err := db.LevelDb.Put(key, val, wo)
	if err != nil {
		db.updateCache(string(key), nil)
	} else {
		db.updateCache(string(key), val)
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
	switch errors.Cause(err) {
	case leveldb.ErrNotFound:
		db.vlogger.CLogf(ctx, libkb.VLog1,
			"notificationThreshold not set; using default value")
	case nil:
		notificationThreshold, err =
			strconv.ParseInt(string(notificationThresholdBytes), 10, 64)
		if err != nil {
			return keybase1.FSSettings{}, err
		}
	default:
		db.logger.CWarningf(ctx,
			"reading notificationThreshold from leveldb error: %+v", err)
		return keybase1.FSSettings{}, err
	}

	var sfmiBannerDismissed bool
	sfmiBannerDismissedBytes, err :=
		db.Get(getSettingsDbKey(uid, sfmiBannerDismissedKey), nil)
	switch errors.Cause(err) {
	case leveldb.ErrNotFound:
		db.vlogger.CLogf(ctx, libkb.VLog1,
			"sfmiBannerDismissed not set; using default value")
	case nil:
		sfmiBannerDismissed, err =
			strconv.ParseBool(string(sfmiBannerDismissedBytes))
		if err != nil {
			return keybase1.FSSettings{}, err
		}
	default:
		db.logger.CWarningf(ctx,
			"reading sfmiBannerDismissed from leveldb error: %+v", err)
		return keybase1.FSSettings{}, err
	}

	var syncOnCellular bool
	syncOnCellularBytes, err :=
		db.Get(getSettingsDbKey(uid, syncOnCellularKey), nil)
	switch errors.Cause(err) {
	case leveldb.ErrNotFound:
		db.vlogger.CLogf(ctx, libkb.VLog1,
			"syncOnCellular not set; using default value")
	case nil:
		syncOnCellular, err = strconv.ParseBool(string(syncOnCellularBytes))
		if err != nil {
			return keybase1.FSSettings{}, err
		}
	default:
		db.logger.CWarningf(ctx,
			"reading syncOnCellular from leveldb error: %+v", err)
		return keybase1.FSSettings{}, err
	}

	return keybase1.FSSettings{
		SpaceAvailableNotificationThreshold: notificationThreshold,
		SfmiBannerDismissed:                 sfmiBannerDismissed,
		SyncOnCellular:                      syncOnCellular,
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

// SetSfmiBannerDismissed sets whether the smfi banner has been dismissed.
func (db *SettingsDB) SetSfmiBannerDismissed(
	ctx context.Context, dismissed bool) error {
	uid := db.getUID(ctx)
	if uid == keybase1.UID("") {
		return errNoSession
	}
	return db.Put(getSettingsDbKey(uid, sfmiBannerDismissedKey),
		[]byte(strconv.FormatBool(dismissed)), nil)
}

// SetSyncOnCellular sets whether we should do TLF syncing on a
// cellular network.
func (db *SettingsDB) SetSyncOnCellular(
	ctx context.Context, syncOnCellular bool) error {
	uid := db.getUID(ctx)
	if uid == keybase1.UID("") {
		return errNoSession
	}
	return db.Put(getSettingsDbKey(uid, syncOnCellularKey),
		[]byte(strconv.FormatBool(syncOnCellular)), nil)
}
