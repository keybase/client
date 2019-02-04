// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/windows/registry"
	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"

	"io/ioutil"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// Install only handles the driver part on Windows
func Install(context Context, binPath string, sourcePath string, components []string, force bool, timeout time.Duration, log Log) keybase1.InstallResult {
	return keybase1.InstallResult{}
}

func componentResult(name string, err error) keybase1.ComponentResult {
	if err != nil {
		return keybase1.ComponentResult{Name: string(name), Status: keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, err.Error())}
	}
	return keybase1.ComponentResult{Name: string(name), Status: keybase1.StatusOK("")}
}

// AutoInstall is not supported on Windows
func AutoInstall(context Context, binPath string, force bool, timeout time.Duration, log Log) (bool, error) {
	return false, nil
}

// Uninstall empty implementation for unsupported platforms
func Uninstall(context Context, components []string, log Log) keybase1.UninstallResult {
	return keybase1.UninstallResult{}
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

func rqBinPath() (string, error) {
	path, err := BinPath()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(path), "keybaserq.exe"), nil
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

	// Get the latest msi log - this is the clean install .msi log
	msiLogFiles, err := filepath.Glob(os.ExpandEnv(filepath.Join("${TEMP}", "MSI*.LOG")))
	sort.Sort(sort.Reverse(sort.StringSlice(msiLogFiles)))
	if len(msiLogFiles) >= 1 {
		keybaseLogFiles = append(keybaseLogFiles, msiLogFiles[0])
	}

	// Get the 2 newest dokan logs - sorting by name works because timestamp
	dokanLogFiles, err := filepath.Glob(os.ExpandEnv(filepath.Join("${TEMP}", "Dokan*.log")))
	sort.Sort(sort.Reverse(sort.StringSlice(dokanLogFiles)))
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

// WatchdogLogPath combines a handful of watchdog logs in to one for
// server upload.
func WatchdogLogPath(logGlobPath string) (string, error) {
	// Get the 5 newest watchdog logs - sorting by name works because timestamp
	watchdogLogFiles, err := filepath.Glob(logGlobPath)
	sort.Sort(sort.Reverse(sort.StringSlice(watchdogLogFiles)))
	if len(watchdogLogFiles) > 5 {
		watchdogLogFiles = watchdogLogFiles[:5]
	}

	logName, logFile, err := libkb.OpenTempFile("KeybaseWatchdogUpload", ".log", 0)
	defer logFile.Close()
	if err != nil {
		return "", err
	}

	if len(watchdogLogFiles) == 0 {
		fmt.Fprintf(logFile, "   --- NO WATCHDOG LOGS FOUND!?! ---\n")
	}
	for _, path := range watchdogLogFiles {
		fmt.Fprintf(logFile, "   --- %s ---\n", path)

		// append the files
		func() {
			fd, err := os.Open(path)
			defer fd.Close()
			if err != nil {
				fmt.Fprintf(logFile, "open error: %s\n", err.Error())
				return
			}
			_, err = io.Copy(logFile, fd)
			if err != nil {
				fmt.Fprintf(logFile, "copy error: %s\n", err.Error())
			}
		}()
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

	// Check whether the service shortcut is still present and not disabled
	if appDataDir, err := libkb.AppDataDir(); err != nil {
		logFile.WriteString("Error getting AppDataDir\n")
	} else {
		if exists, err := libkb.FileExists(filepath.Join(appDataDir, "Microsoft\\Windows\\Start Menu\\Programs\\Startup\\KeybaseStartup.lnk")); err == nil && exists == false {
			logFile.WriteString("  -- Service startup shortcut missing! --\n\n")
		} else if err != nil {
			k, err := registry.OpenKey(registry.CURRENT_USER, "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder", registry.QUERY_VALUE|registry.READ)
			if err != nil {
				logFile.WriteString("Error opening Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder\n")
			} else {
				val, _, err := k.GetBinaryValue("KeybaseStartup.lnk")
				if err == nil && len(val) > 0 && val[0] != 2 {
					logFile.WriteString("  -- Service startup shortcut disabled in registry! --\n\n")
				}
			}
		}
	}

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

// IsInUse returns true if the mount is in use. This may be used by the updater
// to determine if it's safe to apply an update and restart.
func IsInUse(mountDir string, log Log) bool {
	if mountDir == "" {
		return false
	}
	if _, serr := os.Stat(mountDir); os.IsNotExist(serr) {
		log.Debug("%s doesn't exist", mountDir)
		return false
	}

	dat, err := ioutil.ReadFile(filepath.Join(mountDir, ".kbfs_number_of_handles"))
	if err != nil {
		log.Debug("Error reading kbfs handles: %s", err)
		return false
	}
	i, err := strconv.Atoi(string(dat))
	if err != nil {
		log.Debug("Error converting count of kbfs handles: %s", err)
		return false
	}
	if i > 0 {
		log.Debug("Found kbfs handles in use: %d", i)
		return true
	}

	return false
}

func getCachedPackageModifyString(log Log) (string, error) {

	k, err := registry.OpenKey(registry.CURRENT_USER, `SOFTWARE\Keybase\Keybase\`, registry.READ|registry.WOW64_64KEY)
	defer k.Close()
	if err != nil {
		log.Debug("getCachedPackageModifyString: can't open SOFTWARE\\Keybase\\Keybase\\")
		return "", err
	}
	bundleKey, _, err := k.GetStringValue("BUNDLEKEY")
	if err != nil || bundleKey == "" {
		log.Debug("getCachedPackageModifyString: can't read SOFTWARE\\Keybase\\Keybase\\BUNDLEKEY")
		return "", err
	}

	k2, err := registry.OpenKey(registry.CURRENT_USER, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`+bundleKey, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err != nil {
		log.Debug("getCachedPackageModifyString: can't read " + `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` + bundleKey)
		return "", err
	}
	displayName, _, err := k2.GetStringValue("DisplayName")
	if err != nil {
		log.Debug("getCachedPackageModifyString: can't read DisplayName of " + `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` + bundleKey)
	}
	publisher, _, err := k2.GetStringValue("Publisher")
	if err != nil {
		log.Debug("getCachedPackageModifyString: can't read publisher of " + `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` + bundleKey)
	}
	if displayName == "Keybase" && publisher == "Keybase, Inc." {
		modify, _, err := k2.GetStringValue("ModifyPath")
		return modify, err
	}
	log.Debug("getCachedPackageModifyString: " + `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` + bundleKey + "displayName " + displayName + ", publisher " + publisher)
	return "", errors.New("no cached package path found")
}

// StartUpdateIfNeeded starts to update the app if there's one available. It
// calls `updater check` internally so it ignores the snooze.
func StartUpdateIfNeeded(ctx context.Context, log logger.Logger) error {
	rqPath, err := rqBinPath()
	if err != nil {
		return err
	}
	updaterPath, err := UpdaterBinPath()
	if err != nil {
		return err
	}
	log.Debug("Starting updater with keybaserq.exe")
	if err = exec.Command(rqPath, updaterPath, "check").Run(); err != nil {
		return err
	}
	return nil
}

func LsofMount(mountDir string, log Log) ([]CommonLsofResult, error) {
	log.Warning("Cannot use lsof on Windows.")
	return nil, fmt.Errorf("Cannot use lsof on Windows.")
}
