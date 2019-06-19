// +build ios android

package install

import "github.com/keybase/client/go/libkb"

func KBFSBinPath(runMode libkb.RunMode, binPath string) (string, error) {
	return "", nil
}

func kbfsBinName() string {
	return ""
}

func updaterBinName() (string, error) {
	return "", nil
}

// InstallLogPath doesn't exist on darwin as an independent log file (see desktop app log)
func InstallLogPath() (string, error) {
	return "", nil
}

// WatchdogLogPath doesn't exist on darwin as an independent log file (see desktop app log)
func WatchdogLogPath(string) (string, error) {
	return "", nil
}

// SystemLogPath is where privileged keybase processes log to on darwin
func SystemLogPath() string {
	return ""
}
