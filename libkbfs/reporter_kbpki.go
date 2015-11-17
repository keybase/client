package libkbfs

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol"
)

// ReporterKBPKI implements the Notify function of the Reporter
// interface in addition to embedding ReporterSimple for error
// tracking.  Notify will make RPCs to the keybase daemon.
type ReporterKBPKI struct {
	*ReporterSimple
	kbpki KBPKI
}

// NewReporterKBPKI creates a new ReporterKBPKI.
func NewReporterKBPKI(clock Clock, maxErrors int, kbpki KBPKI) *ReporterKBPKI {
	return &ReporterKBPKI{
		ReporterSimple: NewReporterSimple(clock, maxErrors),
		kbpki:          kbpki,
	}
}

// Notify implements the Reporter interface for ReporterSimple.
func (r *ReporterKBPKI) Notify(notification keybase1.FSNotification) {
	fmt.Printf("ReporterKBPKI: Notify -> %+v\n", notification)
}
