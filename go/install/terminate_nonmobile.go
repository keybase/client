// +build !ios,!android

package install

import (
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-updater/process"
)

// TerminateApp will stop the Keybase (UI) app
func TerminateApp(context Context, log Log) error {
	appExecName := "Keybase"
	logf := logger.NewLoggerf(log)
	log.Info("Stopping Keybase app")
	appPIDs := process.TerminateAll(process.NewMatcher(appExecName, process.ExecutableEqual, logf), 5*time.Second, logf)
	if len(appPIDs) > 0 {
		log.Info("Terminated %s %v", appExecName, appPIDs)
	} else {
		log.Debug("Did not terminate anything")
	}
	return nil
}
