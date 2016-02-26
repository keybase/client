package libkbfs

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

const (
	// error param keys
	errorParamTlf       = "tlf"
	errorParamMode      = "mode"
	errorParamFeature   = "feature"
	errorParamUsername  = "username"
	errorParamExternal  = "external"
	errorParamRekeySelf = "rekeyself"

	// error operation modes
	errorModeRead  = "read"
	errorModeWrite = "write"
)

const connectionStatusConnected keybase1.FSStatusCode = keybase1.FSStatusCode_START
const connectionStatusDisconnected keybase1.FSStatusCode = keybase1.FSStatusCode_ERROR

// noErrorUsernames are user names that should not result in an error
// notification.  These should all be reserved Keybase usernames that
// will never be associated with a real account.
var noErrorUsernames = map[string]bool{
	"objects": true, // git shells
	"gemfile": true, // rvm
	"devfs":   true, // lsof?  KBFS-823
	"_mtn":    true, // emacs on Linux
}

// ReporterKBPKI implements the Notify function of the Reporter
// interface in addition to embedding ReporterSimple for error
// tracking.  Notify will make RPCs to the keybase daemon.
type ReporterKBPKI struct {
	*ReporterSimple
	config       Config
	log          logger.Logger
	notifyBuffer chan *keybase1.FSNotification
	canceler     func()
}

// NewReporterKBPKI creates a new ReporterKBPKI.
func NewReporterKBPKI(config Config, maxErrors, bufSize int) *ReporterKBPKI {
	r := &ReporterKBPKI{
		ReporterSimple: NewReporterSimple(config.Clock(), maxErrors),
		config:         config,
		log:            config.MakeLogger(""),
		notifyBuffer:   make(chan *keybase1.FSNotification, bufSize),
	}
	var ctx context.Context
	ctx, r.canceler = context.WithCancel(context.Background())
	go r.send(ctx)
	return r
}

// ReportErr implements the Reporter interface for ReporterKBPKI.
func (r *ReporterKBPKI) ReportErr(ctx context.Context,
	tlfName CanonicalTlfName, public bool, mode ErrorModeType, err error) {
	r.ReporterSimple.ReportErr(ctx, tlfName, public, mode, err)

	// Fire off error popups
	var n *keybase1.FSNotification
	params := make(map[string]string)
	var code keybase1.FSErrorType = -1
	switch e := err.(type) {
	case ReadAccessError:
		code = keybase1.FSErrorType_ACCESS_DENIED
	case WriteAccessError:
		code = keybase1.FSErrorType_ACCESS_DENIED
	case NoSuchUserError:
		if !noErrorUsernames[e.Input] {
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
	}

	if code < 0 && err == context.DeadlineExceeded {
		code = keybase1.FSErrorType_TIMEOUT
	}

	if code >= 0 {
		n = errorNotification(err, code, tlfName, public, mode, params)
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

// Shutdown implements the Reporter interface for ReporterKBPKI.
func (r *ReporterKBPKI) Shutdown() {
	r.canceler()
	close(r.notifyBuffer)
}

// send takes notifications out of notifyBuffer and sends them to
// the keybase daemon.
func (r *ReporterKBPKI) send(ctx context.Context) {
	for notification := range r.notifyBuffer {
		if err := r.config.KeybaseDaemon().Notify(ctx, notification); err != nil {
			r.log.CDebugf(ctx, "ReporterDaemon: error sending notification: %s",
				err)
		}
	}
}

// writeNotification creates FSNotifications from paths for file
// write events.
func writeNotification(file path, finish bool) *keybase1.FSNotification {
	n := baseNotification(file, finish)
	if file.Tlf.IsPublic() {
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
	if file.Tlf.IsPublic() {
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
		PublicTopLevelFolder: handle.IsPublic(),
		Filename:             string(handle.GetCanonicalName(ctx, config)),
		StatusCode:           code,
		NotificationType:     keybase1.FSNotificationType_REKEYING,
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
func baseNotification(file path, finish bool) *keybase1.FSNotification {
	code := keybase1.FSStatusCode_START
	if finish {
		code = keybase1.FSStatusCode_FINISH
	}

	return &keybase1.FSNotification{
		PublicTopLevelFolder: file.Tlf.IsPublic(),
		Filename:             file.String(),
		StatusCode:           code,
	}
}

// genericErrorNotification creates FSNotifications for generic
// errors, and makes it look like a read error.
func errorNotification(err error, errType keybase1.FSErrorType,
	tlfName CanonicalTlfName, public bool, mode ErrorModeType,
	params map[string]string) *keybase1.FSNotification {
	if tlfName != "" {
		params[errorParamTlf] = buildCanonicalPath(public, tlfName)
	}
	var nType keybase1.FSNotificationType
	switch mode {
	case ReadMode:
		params[errorParamMode] = errorModeRead
		if public {
			nType = keybase1.FSNotificationType_VERIFYING
		} else {
			nType = keybase1.FSNotificationType_DECRYPTING
		}
	case WriteMode:
		params[errorParamMode] = errorModeWrite
		if public {
			nType = keybase1.FSNotificationType_SIGNING
		} else {
			nType = keybase1.FSNotificationType_ENCRYPTING
		}
	default:
		panic(fmt.Sprintf("Unknown mode: %v", mode))
	}
	return &keybase1.FSNotification{
		Filename:         params[errorParamTlf],
		StatusCode:       keybase1.FSStatusCode_ERROR,
		Status:           err.Error(),
		ErrorType:        errType,
		Params:           params,
		NotificationType: nType,
	}
}
