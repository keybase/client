package libkbfs

import (
	"fmt"
	"time"
)

// TimeAndWriterConflictRenamer renames a file using the current time
// and the writer of that file.
type TimeAndWriterConflictRenamer struct {
	config Config
}

// GetConflictSuffix implements the ConflictRename interface for
// TimeAndWriterConflictRenamer.
func (cr TimeAndWriterConflictRenamer) GetConflictSuffix(op op) string {
	now := cr.config.Clock().Now()
	nowString := now.Format(time.RFC3339Nano)
	return fmt.Sprintf(".conflict.%s.%s", op.getWriterName(), nowString)
}
