package libkbfs

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// TimeAndWriterConflictRenamer renames a file using the current time
// and the writer of that file.
type timeAndWriterConflictRenamer struct {
	config Config
}

// GetConflictSuffix implements the ConflictRename interface for
// TimeAndWriterConflictRenamer.
func (cr timeAndWriterConflictRenamer) GetConflictSuffix(op op) string {
	now := cr.config.Clock().Now()
	nowString := now.Format(time.RFC3339Nano)
	return fmt.Sprintf(".conflict.%s.%s", op.getWriterInfo().name, nowString)
}

// TimeAndWriterConflictRenamer renames a file using the current time
// and the writer of that file.
type WriterDeviceDateConflictRenamer struct {
	config Config
}

// GetConflictSuffix implements the ConflictRename interface for
// TimeAndWriterConflictRenamer.
func (cr WriterDeviceDateConflictRenamer) GetConflictSuffix(op op) string {
	now := cr.config.Clock().Now()
	nowString := now.Format("2006-01-02")
	winfo := op.getWriterInfo()
	dname := winfo.dname
	if dname == "" {
		dname = "unknown"
	}
	return fmt.Sprintf(".conflict.%s.%s.%s", winfo.name, dname, nowString)
}

func newWriterInfo(ctx context.Context, cfg Config, uid keybase1.UID, kid keybase1.KID) (writerInfo, error) {
	ui, err := cfg.KeybaseDaemon().LoadUserPlusKeys(ctx, uid)
	if err != nil {
		return writerInfo{}, err
	}

	return writerInfo{name: ui.Name, kid: kid, dname: ui.KIDNames[kid]}, nil
}
