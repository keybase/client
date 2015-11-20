package libkbfs

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
)

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
	go r.send()
	return r
}

// Notify implements the Reporter interface for ReporterKBPKI.
//
// TODO: might be useful to get the debug tags out of ctx and store
//       them in the notifyBuffer as well so that send() can put
//       them back in its context.
func (r *ReporterKBPKI) Notify(ctx context.Context, notification *keybase1.FSNotification) {
	select {
	case r.notifyBuffer <- notification:
		r.log.Debug("ReporterKBPKI: Notify -> %+v", notification)
	default:
		r.log.Debug("ReporterKBPKI: notify buffer full, dropping %+v", notification)
	}
}

// Shutdown implements the Reporter interface for ReporterKBPKI.
func (r *ReporterKBPKI) Shutdown() {
	r.canceler()
	close(r.notifyBuffer)
}

// send takes notifications out of notifyBuffer and sends them to
// the keybase daemon.
func (r *ReporterKBPKI) send() {
	for notification := range r.notifyBuffer {
		r.log.Debug("ReporterKBPKI: sending notification %+v", notification)
		var ctx context.Context
		ctx, r.canceler = context.WithCancel(context.Background())
		if err := r.config.KBPKI().Notify(ctx, notification); err != nil {
			r.log.Debug("ReporterKBPKI: error sending notification: %s", err)
		}
		r.canceler()
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
		Filename:             handle.ToString(ctx, config),
		StatusCode:           code,
		NotificationType:     keybase1.FSNotificationType_REKEYING,
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
