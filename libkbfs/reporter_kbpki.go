// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	// error param keys
	errorParamTlf                 = "tlf"
	errorParamMode                = "mode"
	errorParamFeature             = "feature"
	errorParamUsername            = "username"
	errorParamExternal            = "external"
	errorParamRekeySelf           = "rekeyself"
	errorParamUsageBytes          = "usageBytes"
	errorParamLimitBytes          = "limitBytes"
	errorParamUsageFiles          = "usageFiles"
	errorParamLimitFiles          = "limitFiles"
	errorParamRenameOldFilename   = "oldFilename"
	errorParamFoldersCreated      = "foldersCreated"
	errorParamFolderLimit         = "folderLimit"
	errorParamApplicationExecPath = "applicationExecPath"

	// error operation modes
	errorModeRead  = "read"
	errorModeWrite = "write"

	// features that aren't ready yet
	errorFeatureFileLimit = "2gbFileLimit"
	errorFeatureDirLimit  = "512kbDirLimit"
)

const connectionStatusConnected keybase1.FSStatusCode = keybase1.FSStatusCode_START
const connectionStatusDisconnected keybase1.FSStatusCode = keybase1.FSStatusCode_ERROR

// noErrorNames are lookup names that should not result in an error
// notification.  These should all be reserved or illegal Keybase
// usernames that will never be associated with a real account.
var noErrorNames = map[string]bool{
	"objects":        true, // git shells
	"gemfile":        true, // rvm
	"Gemfile":        true, // rvm
	"devfs":          true, // lsof?  KBFS-823
	"_mtn":           true, // emacs on Linux
	"_MTN":           true, // emacs on Linux
	"docker-machine": true, // docker shell stuff
	"HEAD":           true, // git shell
	"Keybase.app":    true, // some OSX mount thing
	"DCIM":           true, // looking for digital pic folder
	"Thumbs.db":      true, // Windows mounts
	"config":         true, // Windows, possibly 7-Zip?
	"m4root":         true, // OS X, iMovie?
	"BDMV":           true, // OS X, iMovie?
	"node_modules":   true, // Some npm shell configuration
	"folder":         true, // Dolphin?  keybase/client#7304
	"avchd":          true, // Sony PlayMemories Home, keybase/client#6801
	"avchd_bk":       true, // Sony PlayMemories Home, keybase/client#6801
	"sony":           true, // Sony PlayMemories Home, keybase/client#6801
}

// ReporterKBPKI implements the Notify function of the Reporter
// interface in addition to embedding ReporterSimple for error
// tracking.  Notify will make RPCs to the keybase daemon.
type ReporterKBPKI struct {
	*ReporterSimple
	config           Config
	log              logger.Logger
	notifyBuffer     chan *keybase1.FSNotification
	notifySyncBuffer chan *keybase1.FSPathSyncStatus
	canceler         func()
}

// NewReporterKBPKI creates a new ReporterKBPKI.
func NewReporterKBPKI(config Config, maxErrors, bufSize int) *ReporterKBPKI {
	r := &ReporterKBPKI{
		ReporterSimple:   NewReporterSimple(config.Clock(), maxErrors),
		config:           config,
		log:              config.MakeLogger(""),
		notifyBuffer:     make(chan *keybase1.FSNotification, bufSize),
		notifySyncBuffer: make(chan *keybase1.FSPathSyncStatus, bufSize),
	}
	var ctx context.Context
	ctx, r.canceler = context.WithCancel(context.Background())
	go r.send(ctx)
	return r
}

// ReportErr implements the Reporter interface for ReporterKBPKI.
func (r *ReporterKBPKI) ReportErr(ctx context.Context,
	tlfName CanonicalTlfName, t tlf.Type, mode ErrorModeType, err error) {
	r.ReporterSimple.ReportErr(ctx, tlfName, t, mode, err)

	// Fire off error popups
	params := make(map[string]string)
	filename := ""
	var code keybase1.FSErrorType = -1
	switch e := errors.Cause(err).(type) {
	case ReadAccessError:
		code = keybase1.FSErrorType_ACCESS_DENIED
		params[errorParamMode] = errorModeRead
		filename = e.Filename
	case WriteAccessError:
		code = keybase1.FSErrorType_ACCESS_DENIED
		params[errorParamUsername] = e.User.String()
		params[errorParamMode] = errorModeWrite
		filename = e.Filename
	case WriteUnsupportedError:
		code = keybase1.FSErrorType_ACCESS_DENIED
		params[errorParamMode] = errorModeWrite
		filename = e.Filename
	case NoSuchUserError:
		if !noErrorNames[e.Input] {
			code = keybase1.FSErrorType_USER_NOT_FOUND
			params[errorParamUsername] = e.Input
			if strings.ContainsAny(e.Input, "@:") {
				params[errorParamExternal] = "true"
			} else {
				params[errorParamExternal] = "false"
			}
		}
	case UnverifiableTlfUpdateError:
		code = keybase1.FSErrorType_REVOKED_DATA_DETECTED
	case NoCurrentSessionError:
		code = keybase1.FSErrorType_NOT_LOGGED_IN
	case NeedSelfRekeyError:
		code = keybase1.FSErrorType_REKEY_NEEDED
		params[errorParamRekeySelf] = "true"
	case NeedOtherRekeyError:
		code = keybase1.FSErrorType_REKEY_NEEDED
		params[errorParamRekeySelf] = "false"
	case FileTooBigError:
		code = keybase1.FSErrorType_NOT_IMPLEMENTED
		params[errorParamFeature] = errorFeatureFileLimit
	case FileTooBigForCRError:
		code = keybase1.FSErrorType_NOT_IMPLEMENTED
		params[errorParamFeature] = errorFeatureFileLimit
	case DirTooBigError:
		code = keybase1.FSErrorType_NOT_IMPLEMENTED
		params[errorParamFeature] = errorFeatureDirLimit
	case NewMetadataVersionError:
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
	case NoSigChainError:
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
		r.log.CDebugf(ctx, "ReporterKBPKI: notify buffer full, dropping %+v",
			notification)
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
		r.log.CDebugf(ctx, "ReporterKBPKI: notify sync buffer full, "+
			"dropping %+v", status)
	}
}

// Shutdown implements the Reporter interface for ReporterKBPKI.
func (r *ReporterKBPKI) Shutdown() {
	r.canceler()
	close(r.notifyBuffer)
	close(r.notifySyncBuffer)
}

// send takes notifications out of notifyBuffer and notifySyncBuffer
// and sends them to the keybase daemon.
func (r *ReporterKBPKI) send(ctx context.Context) {
	for {
		select {
		case notification, ok := <-r.notifyBuffer:
			if !ok {
				return
			}
			if err := r.config.KeybaseService().Notify(ctx,
				notification); err != nil {
				r.log.CDebugf(ctx, "ReporterDaemon: error sending "+
					"notification: %s", err)
			}
		case status, ok := <-r.notifySyncBuffer:
			if !ok {
				return
			}
			if err := r.config.KeybaseService().NotifySyncStatus(ctx,
				status); err != nil {
				r.log.CDebugf(ctx, "ReporterDaemon: error sending "+
					"sync status: %s", err)
			}
		}
	}
}

// writeNotification creates FSNotifications from paths for file
// write events.
func writeNotification(file path, finish bool) *keybase1.FSNotification {
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
func readNotification(file path, finish bool) *keybase1.FSNotification {
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
func rekeyNotification(ctx context.Context, config Config, handle *TlfHandle, finish bool) *keybase1.FSNotification {
	code := keybase1.FSStatusCode_START
	if finish {
		code = keybase1.FSStatusCode_FINISH
	}

	return &keybase1.FSNotification{
		FolderType:       handle.Type().FolderType(),
		Filename:         string(handle.GetCanonicalPath()),
		StatusCode:       code,
		NotificationType: keybase1.FSNotificationType_REKEYING,
	}
}

func baseFileEditNotification(file path, writer keybase1.UID,
	localTime time.Time) *keybase1.FSNotification {
	n := baseNotification(file, true)
	n.WriterUid = writer
	n.LocalTime = keybase1.ToTime(localTime)
	return n
}

// fileCreateNotification creates FSNotifications from paths for file
// create events.
func fileCreateNotification(file path, writer keybase1.UID,
	localTime time.Time) *keybase1.FSNotification {
	n := baseFileEditNotification(file, writer, localTime)
	n.NotificationType = keybase1.FSNotificationType_FILE_CREATED
	return n
}

// fileModifyNotification creates FSNotifications from paths for file
// modification events.
func fileModifyNotification(file path, writer keybase1.UID,
	localTime time.Time) *keybase1.FSNotification {
	n := baseFileEditNotification(file, writer, localTime)
	n.NotificationType = keybase1.FSNotificationType_FILE_MODIFIED
	return n
}

// fileDeleteNotification creates FSNotifications from paths for file
// delete events.
func fileDeleteNotification(file path, writer keybase1.UID,
	localTime time.Time) *keybase1.FSNotification {
	n := baseFileEditNotification(file, writer, localTime)
	n.NotificationType = keybase1.FSNotificationType_FILE_DELETED
	return n
}

// fileRenameNotification creates FSNotifications from paths for file
// rename events.
func fileRenameNotification(oldFile path, newFile path, writer keybase1.UID,
	localTime time.Time) *keybase1.FSNotification {
	n := baseFileEditNotification(newFile, writer, localTime)
	n.NotificationType = keybase1.FSNotificationType_FILE_RENAMED
	n.Params = map[string]string{errorParamRenameOldFilename: oldFile.CanonicalPathString()}
	return n
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
func baseNotification(file path, finish bool) *keybase1.FSNotification {
	code := keybase1.FSStatusCode_START
	if finish {
		code = keybase1.FSStatusCode_FINISH
	}

	return &keybase1.FSNotification{
		Filename:   file.CanonicalPathString(),
		StatusCode: code,
	}
}

// errorNotification creates FSNotifications for errors.
func errorNotification(err error, errType keybase1.FSErrorType,
	tlfName CanonicalTlfName, t tlf.Type, mode ErrorModeType,
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

func mdReadSuccessNotification(handle *TlfHandle,
	public bool) *keybase1.FSNotification {
	params := make(map[string]string)
	if handle != nil {
		params[errorParamTlf] = string(handle.GetCanonicalName())
	}
	return &keybase1.FSNotification{
		FolderType:       handle.Type().FolderType(),
		Filename:         string(handle.GetCanonicalPath()),
		StatusCode:       keybase1.FSStatusCode_START,
		NotificationType: keybase1.FSNotificationType_MD_READ_SUCCESS,
		Params:           params,
	}
}
