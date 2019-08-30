// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	// error param keys
	errorParamTlf                 = "tlf"
	errorParamMode                = "mode"
	errorParamUsername            = "username"
	errorParamRekeySelf           = "rekeyself"
	errorParamUsageBytes          = "usageBytes"
	errorParamLimitBytes          = "limitBytes"
	errorParamUsageFiles          = "usageFiles"
	errorParamLimitFiles          = "limitFiles"
	errorParamFoldersCreated      = "foldersCreated"
	errorParamFolderLimit         = "folderLimit"
	errorParamApplicationExecPath = "applicationExecPath"

	// error operation modes
	errorModeRead  = "read"
	errorModeWrite = "write"
)

const connectionStatusConnected keybase1.FSStatusCode = keybase1.FSStatusCode_START
const connectionStatusDisconnected keybase1.FSStatusCode = keybase1.FSStatusCode_ERROR

// ReporterKBPKI implements the Notify function of the Reporter
// interface in addition to embedding ReporterSimple for error
// tracking.  Notify will make RPCs to the keybase daemon.
type ReporterKBPKI struct {
	*ReporterSimple
	config                  Config
	log                     logger.Logger
	vlog                    *libkb.VDebugLog
	notifyBuffer            chan *keybase1.FSNotification
	onlineStatusBuffer      chan bool
	notifyPathBuffer        chan string
	notifySyncBuffer        chan *keybase1.FSPathSyncStatus
	notifyOverallSyncBuffer chan keybase1.FolderSyncStatus
	notifyFavsBuffer        chan struct{}
	shutdownCh              chan struct{}
	canceler                func()

	lastNotifyPathLock sync.Mutex
	lastNotifyPath     string
}

// NewReporterKBPKI creates a new ReporterKBPKI.
func NewReporterKBPKI(config Config, maxErrors, bufSize int) *ReporterKBPKI {
	log := config.MakeLogger("")
	r := &ReporterKBPKI{
		ReporterSimple:          NewReporterSimple(config.Clock(), maxErrors),
		config:                  config,
		log:                     log,
		vlog:                    config.MakeVLogger(log),
		notifyBuffer:            make(chan *keybase1.FSNotification, bufSize),
		onlineStatusBuffer:      make(chan bool, bufSize),
		notifyPathBuffer:        make(chan string, 1),
		notifySyncBuffer:        make(chan *keybase1.FSPathSyncStatus, 1),
		notifyOverallSyncBuffer: make(chan keybase1.FolderSyncStatus, 1),
		notifyFavsBuffer:        make(chan struct{}, 1),
		shutdownCh:              make(chan struct{}),
	}
	var ctx context.Context
	ctx, r.canceler = context.WithCancel(context.Background())
	go r.send(ctx)
	return r
}

// ReportErr implements the Reporter interface for ReporterKBPKI.
func (r *ReporterKBPKI) ReportErr(ctx context.Context,
	tlfName tlf.CanonicalName, t tlf.Type, mode ErrorModeType, err error) {
	r.ReporterSimple.ReportErr(ctx, tlfName, t, mode, err)

	// Fire off error popups
	params := make(map[string]string)
	filename := ""
	var code keybase1.FSErrorType = -1
	switch e := errors.Cause(err).(type) {
	case tlfhandle.ReadAccessError:
		code = keybase1.FSErrorType_ACCESS_DENIED
		params[errorParamMode] = errorModeRead
		filename = e.Filename
	case tlfhandle.WriteAccessError:
		code = keybase1.FSErrorType_ACCESS_DENIED
		params[errorParamUsername] = e.User.String()
		params[errorParamMode] = errorModeWrite
		filename = e.Filename
	case WriteUnsupportedError:
		code = keybase1.FSErrorType_ACCESS_DENIED
		params[errorParamMode] = errorModeWrite
		filename = e.Filename
	case UnverifiableTlfUpdateError:
		code = keybase1.FSErrorType_REVOKED_DATA_DETECTED
	case idutil.NoCurrentSessionError:
		code = keybase1.FSErrorType_NOT_LOGGED_IN
	case NeedSelfRekeyError:
		code = keybase1.FSErrorType_REKEY_NEEDED
		params[errorParamRekeySelf] = "true"
	case NeedOtherRekeyError:
		code = keybase1.FSErrorType_REKEY_NEEDED
		params[errorParamRekeySelf] = "false"
	case kbfsmd.NewMetadataVersionError:
		code = keybase1.FSErrorType_OLD_VERSION
		err = OutdatedVersionError{}
	case kbfsmd.NewMerkleVersionError:
		code = keybase1.FSErrorType_OLD_VERSION
		err = OutdatedVersionError{}
	case NewDataVersionError:
		code = keybase1.FSErrorType_OLD_VERSION
		err = OutdatedVersionError{}
	case OverQuotaWarning:
		code = keybase1.FSErrorType_OVER_QUOTA
		params[errorParamUsageBytes] = strconv.FormatInt(e.UsageBytes, 10)
		params[errorParamLimitBytes] = strconv.FormatInt(e.LimitBytes, 10)
	case *ErrDiskLimitTimeout:
		if !e.reportable {
			return
		}
		code = keybase1.FSErrorType_DISK_LIMIT_REACHED
		params[errorParamUsageBytes] = strconv.FormatInt(e.usageBytes, 10)
		params[errorParamLimitBytes] =
			strconv.FormatFloat(e.limitBytes, 'f', 0, 64)
		params[errorParamUsageFiles] = strconv.FormatInt(e.usageFiles, 10)
		params[errorParamLimitFiles] =
			strconv.FormatFloat(e.limitFiles, 'f', 0, 64)
	case idutil.NoSigChainError:
		code = keybase1.FSErrorType_NO_SIG_CHAIN
		params[errorParamUsername] = e.User.String()
	case kbfsmd.ServerErrorTooManyFoldersCreated:
		code = keybase1.FSErrorType_TOO_MANY_FOLDERS
		params[errorParamFolderLimit] = strconv.FormatUint(e.Limit, 10)
		params[errorParamFoldersCreated] = strconv.FormatUint(e.Created, 10)
	case RenameAcrossDirsError:
		if len(e.ApplicationExecPath) > 0 {
			code = keybase1.FSErrorType_EXDEV_NOT_SUPPORTED
			params[errorParamApplicationExecPath] = e.ApplicationExecPath
		}
	case OfflineArchivedError:
		code = keybase1.FSErrorType_OFFLINE_ARCHIVED
	case OfflineUnsyncedError:
		code = keybase1.FSErrorType_OFFLINE_UNSYNCED
	}

	if code < 0 && err == context.DeadlineExceeded {
		code = keybase1.FSErrorType_TIMEOUT
		// Workaround for DESKTOP-2442
		filename = string(tlfName)
	}

	if code >= 0 {
		n := errorNotification(err, code, tlfName, t, mode, filename, params)
		r.Notify(ctx, n)
	}
}

// Notify implements the Reporter interface for ReporterKBPKI.
//
// TODO: might be useful to get the debug tags out of ctx and store
//       them in the notifyBuffer as well so that send() can put
//       them back in its context.
func (r *ReporterKBPKI) Notify(ctx context.Context, notification *keybase1.FSNotification) {
	select {
	case r.notifyBuffer <- notification:
	default:
		r.vlog.CLogf(
			ctx, libkb.VLog1, "ReporterKBPKI: notify buffer full, dropping %+v",
			notification)
	}
}

// OnlineStatusChanged notifies the service (and eventually GUI) when we
// detected we are connected to or disconnected from mdserver.
func (r *ReporterKBPKI) OnlineStatusChanged(ctx context.Context, online bool) {
	r.onlineStatusBuffer <- online
}

func (r *ReporterKBPKI) setLastNotifyPath(p string) (same bool) {
	r.lastNotifyPathLock.Lock()
	defer r.lastNotifyPathLock.Unlock()
	same = p == r.lastNotifyPath
	r.lastNotifyPath = p
	return same
}

// NotifyPathUpdated implements the Reporter interface for ReporterKBPKI.
//
// TODO: might be useful to get the debug tags out of ctx and store
//       them in the notifyPathBuffer as well so that send() can put
//       them back in its context.
func (r *ReporterKBPKI) NotifyPathUpdated(ctx context.Context, path string) {
	sameAsLast := r.setLastNotifyPath(path)
	select {
	case r.notifyPathBuffer <- path:
	default:
		if sameAsLast {
			r.vlog.CLogf(
				ctx, libkb.VLog1,
				"ReporterKBPKI: notify path buffer full, dropping %s", path)
		} else {
			// This should be rare; it only happens when user switches from one
			// TLF to another, and we happen to have an update from the old TLF
			// in the buffer before switching subscribed TLF.
			r.vlog.CLogf(
				ctx, libkb.VLog1,
				"ReporterKBPKI: notify path buffer full, but path is "+
					"different from last one, so send in a goroutine %s", path)
			go func() {
				select {
				case r.notifyPathBuffer <- path:
				case <-r.shutdownCh:
				}
			}()
		}
	}
}

// NotifySyncStatus implements the Reporter interface for ReporterKBPKI.
//
// TODO: might be useful to get the debug tags out of ctx and store
//       them in the notifyBuffer as well so that send() can put
//       them back in its context.
func (r *ReporterKBPKI) NotifySyncStatus(ctx context.Context,
	status *keybase1.FSPathSyncStatus) {
	select {
	case r.notifySyncBuffer <- status:
	default:
		r.vlog.CLogf(
			ctx, libkb.VLog1, "ReporterKBPKI: notify sync buffer full, "+
				"dropping %+v", status)
	}
}

// NotifyFavoritesChanged implements the Reporter interface for
// ReporterSimple.
func (r *ReporterKBPKI) NotifyFavoritesChanged(ctx context.Context) {
	select {
	case r.notifyFavsBuffer <- struct{}{}:
	default:
		r.vlog.CLogf(
			ctx, libkb.VLog1, "ReporterKBPKI: notify favs buffer full, "+
				"dropping")
	}
}

// NotifyOverallSyncStatus implements the Reporter interface for ReporterKBPKI.
func (r *ReporterKBPKI) NotifyOverallSyncStatus(
	ctx context.Context, status keybase1.FolderSyncStatus) {
	select {
	case r.notifyOverallSyncBuffer <- status:
	default:
		// If this represents a "complete" status, we can't drop it.
		// Instead launch a goroutine to make sure it gets sent
		// eventually.
		if status.PrefetchStatus == keybase1.PrefetchStatus_COMPLETE {
			go func() {
				select {
				case r.notifyOverallSyncBuffer <- status:
				case <-r.shutdownCh:
				}
			}()
		} else {
			r.vlog.CLogf(
				ctx, libkb.VLog1,
				"ReporterKBPKI: notify overall sync buffer dropping %+v",
				status)
		}
	}
}

// Shutdown implements the Reporter interface for ReporterKBPKI.
func (r *ReporterKBPKI) Shutdown() {
	r.canceler()
	close(r.shutdownCh)
	close(r.notifyBuffer)
	close(r.onlineStatusBuffer)
	close(r.notifySyncBuffer)
	close(r.notifyOverallSyncBuffer)
	close(r.notifyFavsBuffer)
}

const (
	reporterSendInterval    = time.Second
	reporterFavSendInterval = 5 * time.Second
)

// send takes notifications out of notifyBuffer, notifyPathBuffer, and
// notifySyncBuffer and sends them to the keybase daemon.
func (r *ReporterKBPKI) send(ctx context.Context) {
	sendTicker := time.NewTicker(reporterSendInterval)
	defer sendTicker.Stop()
	favSendTicker := time.NewTicker(reporterFavSendInterval)
	defer favSendTicker.Stop()

	for {
		select {
		case notification, ok := <-r.notifyBuffer:
			if !ok {
				return
			}
			nt := notification.NotificationType
			st := notification.StatusCode
			// Only these notifications are used in frontend:
			// https://github.com/keybase/client/blob/0d63795105f64289ba4ef20fbefe56aad91bc7e9/shared/util/kbfs-notifications.js#L142-L154
			if nt != keybase1.FSNotificationType_REKEYING &&
				nt != keybase1.FSNotificationType_INITIALIZED &&
				nt != keybase1.FSNotificationType_CONNECTION &&
				nt != keybase1.FSNotificationType_SYNC_CONFIG_CHANGED &&
				st != keybase1.FSStatusCode_ERROR {
				continue
			}
			// Send them right away rather than staging it and waiting for the
			// ticker, since each of them can be distinct from each other.
			if err := r.config.KeybaseService().Notify(ctx,
				notification); err != nil {
				r.log.CDebugf(ctx, "ReporterDaemon: error sending "+
					"notification: %s", err)
			}
		case online, ok := <-r.onlineStatusBuffer:
			if !ok {
				return
			}
			if err := r.config.KeybaseService().NotifyOnlineStatusChanged(ctx, online); err != nil {
				r.log.CDebugf(ctx, "ReporterDaemon: error sending "+
					"NotifyOnlineStatusChanged: %s", err)
			}
		case <-sendTicker.C:
			select {
			case path, ok := <-r.notifyPathBuffer:
				if !ok {
					return
				}
				if err := r.config.KeybaseService().NotifyPathUpdated(
					ctx, path); err != nil {
					r.log.CDebugf(ctx, "ReporterDaemon: error sending "+
						"notification for path: %s", err)
				}
			default:
			}

			select {
			case status, ok := <-r.notifySyncBuffer:
				if !ok {
					return
				}
				if err := r.config.KeybaseService().NotifySyncStatus(ctx,
					status); err != nil {
					r.log.CDebugf(ctx, "ReporterDaemon: error sending "+
						"sync status: %s", err)
				}
			default:
			}

			select {
			case status, ok := <-r.notifyOverallSyncBuffer:
				if !ok {
					return
				}
				if err := r.config.KeybaseService().NotifyOverallSyncStatus(
					ctx, status); err != nil {
					r.log.CDebugf(ctx, "ReporterDaemon: error sending "+
						"overall sync status: %s", err)
				}
			default:
			}
		case <-favSendTicker.C:
			select {
			case _, ok := <-r.notifyFavsBuffer:
				if !ok {
					return
				}
				if err := r.config.KeybaseService().NotifyFavoritesChanged(
					ctx); err != nil {
					r.log.CDebugf(ctx, "ReporterDaemon: error sending "+
						"favorites changed notification: %s", err)
				}
			default:
			}
		case <-ctx.Done():
			return
		}
	}
}

// writeNotification creates FSNotifications from paths for file
// write events.
func writeNotification(file data.Path, finish bool) *keybase1.FSNotification {
	n := baseNotification(file, finish)
	if file.Tlf.Type() == tlf.Public {
		n.NotificationType = keybase1.FSNotificationType_SIGNING
	} else {
		n.NotificationType = keybase1.FSNotificationType_ENCRYPTING
	}
	return n
}

// readNotification creates FSNotifications from paths for file
// read events.
func readNotification(file data.Path, finish bool) *keybase1.FSNotification {
	n := baseNotification(file, finish)
	if file.Tlf.Type() == tlf.Public {
		n.NotificationType = keybase1.FSNotificationType_VERIFYING
	} else {
		n.NotificationType = keybase1.FSNotificationType_DECRYPTING
	}
	return n
}

// rekeyNotification creates FSNotifications from TlfHandles for rekey
// events.
func rekeyNotification(ctx context.Context, config Config, handle *tlfhandle.Handle, finish bool) *keybase1.FSNotification {
	code := keybase1.FSStatusCode_START
	if finish {
		code = keybase1.FSStatusCode_FINISH
	}

	return &keybase1.FSNotification{
		FolderType:       handle.Type().FolderType(),
		Filename:         handle.GetCanonicalPath(),
		StatusCode:       code,
		NotificationType: keybase1.FSNotificationType_REKEYING,
	}
}

// connectionNotification creates FSNotifications based on whether
// or not KBFS is online.
func connectionNotification(status keybase1.FSStatusCode) *keybase1.FSNotification {
	// TODO finish placeholder
	return &keybase1.FSNotification{
		NotificationType: keybase1.FSNotificationType_CONNECTION,
		StatusCode:       status,
	}
}

// baseNotification creates a basic FSNotification without a
// NotificationType from a path.
func baseNotification(file data.Path, finish bool) *keybase1.FSNotification {
	code := keybase1.FSStatusCode_START
	if finish {
		code = keybase1.FSStatusCode_FINISH
	}

	return &keybase1.FSNotification{
		Filename:   file.CanonicalPathPlaintext(),
		StatusCode: code,
	}
}

// errorNotification creates FSNotifications for errors.
func errorNotification(err error, errType keybase1.FSErrorType,
	tlfName tlf.CanonicalName, t tlf.Type, mode ErrorModeType,
	filename string, params map[string]string) *keybase1.FSNotification {
	if tlfName != "" {
		params[errorParamTlf] = string(tlfName)
	}
	var nType keybase1.FSNotificationType
	switch mode {
	case ReadMode:
		params[errorParamMode] = errorModeRead
		if t == tlf.Public {
			nType = keybase1.FSNotificationType_VERIFYING
		} else {
			nType = keybase1.FSNotificationType_DECRYPTING
		}
	case WriteMode:
		params[errorParamMode] = errorModeWrite
		if t == tlf.Public {
			nType = keybase1.FSNotificationType_SIGNING
		} else {
			nType = keybase1.FSNotificationType_ENCRYPTING
		}
	default:
		panic(fmt.Sprintf("Unknown mode: %v", mode))
	}
	return &keybase1.FSNotification{
		FolderType:       t.FolderType(),
		Filename:         filename,
		StatusCode:       keybase1.FSStatusCode_ERROR,
		Status:           err.Error(),
		ErrorType:        errType,
		Params:           params,
		NotificationType: nType,
	}
}

func mdReadSuccessNotification(handle *tlfhandle.Handle,
	public bool) *keybase1.FSNotification {
	params := make(map[string]string)
	if handle != nil {
		params[errorParamTlf] = string(handle.GetCanonicalName())
	}
	return &keybase1.FSNotification{
		FolderType:       handle.Type().FolderType(),
		Filename:         handle.GetCanonicalPath(),
		StatusCode:       keybase1.FSStatusCode_START,
		NotificationType: keybase1.FSNotificationType_MD_READ_SUCCESS,
		Params:           params,
	}
}

func syncConfigChangeNotification(handle *tlfhandle.Handle,
	fsc keybase1.FolderSyncConfig) *keybase1.FSNotification {
	params := map[string]string{
		"syncMode": fsc.Mode.String(),
	}
	return &keybase1.FSNotification{
		FolderType:       handle.Type().FolderType(),
		Filename:         handle.GetCanonicalPath(),
		StatusCode:       keybase1.FSStatusCode_START,
		NotificationType: keybase1.FSNotificationType_SYNC_CONFIG_CHANGED,
		Params:           params,
	}
}
