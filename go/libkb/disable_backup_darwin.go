// +build darwin

package libkb

import (
	"path/filepath"

	"github.com/pkg/xattr"
)

const noBackup = "com.apple.metadata:com_apple_backup_excludeItem com.apple.backupd"

func SetDisableBackup(mctx MetaContext, name string) error {
	path := filepath.Dir(name)
	filename := filepath.Base(name)
	// CrashPlan respects this metadata flag as does TimeMachine.
	// https://support.crashplan.com/Troubleshooting/CrashPlan_And_OS_X_Metadata
	err := xattr.Set(path, filename, []byte(noBackup))
	if err != nil {
		mctx.Debug("Unable to write xattr %s", filepath.Join(path, filename))
	}
	return err
}
