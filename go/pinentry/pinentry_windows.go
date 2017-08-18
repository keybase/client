// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package pinentry

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/logger"
	"golang.org/x/sys/windows/registry"
)

func HasWindows() bool {
	// We're assuming you aren't using windows remotely.
	return true
}

// LookPath searches for an executable binary named file
// in the directories named by the PATH environment variable.
// If file contains a slash, it is tried directly and the PATH is not consulted.

func canExec(s string) error {
	if strings.IndexAny(s, `:\/`) == -1 {
		s += string(filepath.Separator)
	}
	_, err := exec.LookPath(s)
	return err
}

func FindPinentry(log logger.Logger) (string, error) {

	//		// If you install GPG you'll wind up with this pinentry
	//		C:\Program Files (x86)\GNU\GnuPG\pinentry-gtk-2.exe
	//		C:\Program Files (x86)\GNU\GnuPG\pinentry-qt4.exe
	//		C:\Program Files (x86)\GNU\GnuPG\pinentry-w32.exe
	//		C:\Program Files (x86)\GNU\GnuPG\pinentry.exe

	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Wow6432Node\GNU\GnuPG`, registry.QUERY_VALUE)
	if err != nil {
		k, err = registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\GNU\GnuPG`, registry.QUERY_VALUE)
	}
	if err != nil {
		log.Debug("- FindPinentry: can't open registry")
	}
	defer k.Close()

	installDir, _, err := k.GetStringValue("Install Directory")
	if err != nil {
		log.Debug("- FindPinentry: can't get string from registry")
	}

	extraPaths := []string{}

	log.Debug("+ FindPinentry()")

	cmds := []string{
		"pinentry-gtk-2.exe",
		"pinentry-qt4.exe",
		"pinentry-w32.exe",
		"pinentry.exe",
	}

	// First, look where the registry points
	for _, c := range cmds {
		full := filepath.Join(installDir, c)
		log.Debug("| (registry) Looking for %s", full)
		_, err := exec.LookPath(full)
		if err == nil {
			return full, nil
		}
	}

	// Look in program files, just in case
	extraPaths = append(extraPaths, os.Getenv("ProgramFiles"))
	extraPaths = append(extraPaths, os.Getenv("ProgramFiles(x86)"))

	for _, ep := range extraPaths {
		for _, c := range cmds {
			full := filepath.Join(ep, "GNU", "GnuPG", c)
			log.Debug("| Looking for %s", full)
			_, err := exec.LookPath(full)
			if err == nil {
				return full, nil
			}
		}
	}

	log.Debug("- FindPinentry: none found")
	return "", fmt.Errorf("No pinentry found, checked a bunch of different places")
}

func (pe *Pinentry) GetTerminalName() {
	pe.tty = "windows"
}
