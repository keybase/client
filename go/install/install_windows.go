// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// AutoInstall is not supported on Windows
func AutoInstall(context Context, binPath string, force bool, log Log) (newProc bool, err error) {
	return false, fmt.Errorf("Auto install not supported for this build or platform")
}

// CheckIfValidLocation is not supported on Windows
func CheckIfValidLocation() *keybase1.Error {
	return nil
}

// KBFSBinPath returns the path to the KBFS executable
func KBFSBinPath(runMode libkb.RunMode, binPath string) (string, error) {
	return kbfsBinPathDefault(runMode, binPath)
}

func kbfsBinName() string {
	return "kbfsdokan.exe"
}

func updaterBinName() (string, error) {
	// Can't name it updater.exe because of Windows "Install Detection Heuristic",
	// which is complete and total BULLSHIT LOL:
	// https://technet.microsoft.com/en-us/library/cc709628%28v=ws.10%29.aspx?f=255&MSPPError=-2147217396
	return "upd.exe", nil
}

// RunApp starts the app
func RunApp(context Context, log Log) error {
	// TODO: Start the app
	return nil
}

type utfScanner interface {
	Read(p []byte) (n int, err error)
}

// newScannerUTF16or8 creates a scanner similar to os.Open() but decodes
// the file as UTF-16 if the special byte order mark is present.
func newScannerUTF16or8(filename string) (utfScanner, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}

	// Check for BOM
	marker := make([]byte, 2)
	numread, err := io.ReadAtLeast(file, marker, 2)
	file.Seek(0, 0)
	if numread == 2 && err == nil && ((marker[0] == 0xFE && marker[1] == 0xFF) || (marker[0] == 0xFF && marker[1] == 0xFE)) {
		// Make an tranformer that converts MS-Win default to UTF8:
		win16be := unicode.UTF16(unicode.BigEndian, unicode.UseBOM)
		// Make a transformer that is like win16be, but abides by BOM:
		utf16bom := unicode.BOMOverride(win16be.NewDecoder())

		// Make a Reader that uses utf16bom:
		unicodeReader := transform.NewReader(file, utf16bom)
		return unicodeReader, nil
	}
	return file, nil
}

// InstallLogPath combines a handful of install logs in to one for
// server upload.
// Unfortunately, Dokan can generate UTF16 logs, so we test each file
// and translate if necessary.
func InstallLogPath() (string, error) {
	// Get the 3 newest keybase logs - sorting by name works because timestamp
	keybaseLogFiles, err := filepath.Glob(os.ExpandEnv(filepath.Join("${TEMP}", "Keybase*.log")))
	sort.Sort(sort.Reverse(sort.StringSlice(keybaseLogFiles)))

	if len(keybaseLogFiles) > 6 {
		keybaseLogFiles = keybaseLogFiles[:6]
	}
	// Get the 2 newest dokan logs - sorting by name works because timestamp
	dokanLogFiles, err := filepath.Glob(os.ExpandEnv(filepath.Join("${TEMP}", "Dokan*.log")))
	sort.Strings(dokanLogFiles)
	if len(dokanLogFiles) > 2 {
		dokanLogFiles = dokanLogFiles[:2]
	}
	keybaseLogFiles = append(keybaseLogFiles, dokanLogFiles...)

	logName, logFile, err := libkb.OpenTempFile("KeybaseInstallUpload", ".log", 0)
	defer logFile.Close()
	if err != nil {
		return "", err
	}

	getVersionAndDrivers(logFile)

	if len(keybaseLogFiles) == 0 {
		fmt.Fprintf(logFile, "   --- NO INSTALL LOGS FOUND!?! ---\n")
	}
	for _, path := range keybaseLogFiles {
		fmt.Fprintf(logFile, "   --- %s ---\n", path)

		// We have to parse the contents and write them because some files need to
		// be decoded from utf16
		s, err := newScannerUTF16or8(path)
		if err != nil {
			fmt.Fprintf(logFile, "  --- NewScannerUTF16(%s) returns %v---\n", path, err)
		} else {
			scanner := bufio.NewScanner(s)
			for scanner.Scan() {
				fmt.Fprintln(logFile, scanner.Text()) // Println will add back the final '\n'
			}
			if err := scanner.Err(); err != nil {
				fmt.Fprintf(logFile, "  --- error reading (%s): %v---\n", path, err)
			}
		}
		fmt.Fprint(logFile, "\n\n")
	}

	return logName, err
}

func getVersionAndDrivers(logFile *os.File) {
	// Capture Windows Version
	cmd := exec.Command("cmd", "ver")
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	err := cmd.Run()
	if err != nil {
		logFile.WriteString("Error getting version\n")
	}
	logFile.WriteString("\n")

	// Check 64 or 32
	cmd = exec.Command("reg", "query", "HKLM\\Hardware\\Description\\System\\CentralProcessor\\0")
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	err = cmd.Run()
	if err != nil {
		logFile.WriteString("Error getting CPU type\n")
	}
	logFile.WriteString("\n")

	// List filesystem drivers
	outputBytes, err := exec.Command("driverquery").Output()
	if err != nil {
		fmt.Fprintf(logFile, "Error querying drivers: %v\n", err)
	}
	// For now, only list filesystem ones
	scanner := bufio.NewScanner(bytes.NewReader(outputBytes))
	for scanner.Scan() {
		if strings.Contains(scanner.Text(), "File System") {
			logFile.WriteString(scanner.Text() + "\n")
		}
	}
	logFile.WriteString("\n\n")
}

func SystemLogPath() string {
	return ""
}
