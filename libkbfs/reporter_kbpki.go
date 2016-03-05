package libkbfs

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
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
func (r *ReporterKBPKI) ReportErr(ctx context.Context, err error) {
	r.ReporterSimple.ReportErr(ctx, err)

	// Fire off error popups
	var n *keybase1.FSNotification
	switch e := err.(type) {
	case ReadAccessError:
		n = readTlfErrorNotification(e.Tlf, e.Public, err)
	case WriteAccessError:
		n = writeTlfErrorNotification(e.Tlf, e.Public, err)
	case NoSuchUserError:
		if !noErrorUsernames[e.Input] {
			n = genericErrorNotification(err)
		}
	case UnverifiableTlfUpdateError:
		n = genericErrorNotification(err)
	case NoCurrentSessionError:
		n = genericErrorNotification(err)
	case NeedSelfRekeyError:
		n = readTlfErrorNotification(e.Tlf, e.Public, err)
	case NeedOtherRekeyError:
		n = readTlfErrorNotification(e.Tlf, e.Public, err)
	}

	if n == nil && err == context.DeadlineExceeded {
		n = genericErrorNotification(TimeoutError{})
	}

	if n != nil {
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
		Filename:             handle.GetCanonicalPath(ctx, config),
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

// writeTlfErrorNotification creates FSNotifications for general KBFS
// write error events to a TLF.
func writeTlfErrorNotification(tlf CanonicalTlfName, public bool,
	err error) *keybase1.FSNotification {
	n := &keybase1.FSNotification{
		PublicTopLevelFolder: public,
		Filename:             buildCanonicalPath(public, tlf),
		StatusCode:           keybase1.FSStatusCode_ERROR,
		Status:               err.Error(),
	}
	if public {
		n.NotificationType = keybase1.FSNotificationType_SIGNING
	} else {
		n.NotificationType = keybase1.FSNotificationType_ENCRYPTING
	}
	return n
}

// tlfReadErrorNotification creates FSNotifications for general KBFS
// read error events to a TLF.
func readTlfErrorNotification(tlf CanonicalTlfName, public bool,
	err error) *keybase1.FSNotification {
	n := &keybase1.FSNotification{
		PublicTopLevelFolder: public,
		Filename:             buildCanonicalPath(public, tlf),
		StatusCode:           keybase1.FSStatusCode_ERROR,
		Status:               err.Error(),
	}
	if public {
		n.NotificationType = keybase1.FSNotificationType_VERIFYING
	} else {
		n.NotificationType = keybase1.FSNotificationType_DECRYPTING
	}
	return n
}

// genericErrorNotification creates FSNotifications for generic
// errors, and makes it look like a read error.
func genericErrorNotification(err error) *keybase1.FSNotification {
	// The GUI parses this but doesn't use it if the status is filled
	// in.
	//
	// TODO: plumb through at least the TLF name to wherever generates
	// these errors, and require a path or tlf name here.
	fakeFile := "/"
	n := &keybase1.FSNotification{
		Filename:   fakeFile,
		StatusCode: keybase1.FSStatusCode_ERROR,
		Status:     err.Error(),
	}
	n.NotificationType = keybase1.FSNotificationType_VERIFYING
	return n
}
