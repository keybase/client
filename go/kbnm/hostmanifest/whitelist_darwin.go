// +build darwin

package hostmanifest

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/chat/attachments"
)

func wrapWriteErr(err error, hostsPath string) error {
	// we do this temporarily to get the macOS SDK version to 10.14
	// see https://github.com/keybase/client/pull/17811
	attachments.LinkNoop()
	if !os.IsPermission(err) {
		return err
	}
	dirName := filepath.Dir(hostsPath)
	// This error is pretty common on macOS because other NativeMessaging apps
	// tend to change the owner of the directory after they install
	// themselves. How rude.
	return fmt.Errorf("%s: Make sure you are the owner of the directory. "+
		"You can run:\n "+
		"  sudo chown -R $(whoami):staff %q", err, dirName)
}
