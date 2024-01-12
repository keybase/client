// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/kardianos/osext"
	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/command"
	"github.com/keybase/client/go/updater/process"
	"github.com/keybase/client/go/updater/util"
	"github.com/keybase/go-ps"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

type guid struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

var (
	// FOLDERID_LocalAppData
	// F1B32785-6FBA-4FCF-9D55-7B8E7F157091
	folderIDLocalAppData = guid{0xF1B32785, 0x6FBA, 0x4FCF, [8]byte{0x9D, 0x55, 0x7B, 0x8E, 0x7F, 0x15, 0x70, 0x91}}

	// FOLDERID_RoamingAppData
	// {3EB685DB-65F9-4CF6-A03A-E3EF65729F3D}
	folderIDRoamingAppData = guid{0x3EB685DB, 0x65F9, 0x4CF6, [8]byte{0xA0, 0x3A, 0xE3, 0xEF, 0x65, 0x72, 0x9F, 0x3D}}
)

var (
	modShell32               = windows.NewLazySystemDLL("Shell32.dll")
	modOle32                 = windows.NewLazySystemDLL("Ole32.dll")
	procSHGetKnownFolderPath = modShell32.NewProc("SHGetKnownFolderPath")
	procCoTaskMemFree        = modOle32.NewProc("CoTaskMemFree")
)

func coTaskMemFree(pv uintptr) (err error) {
	_, _, errno := syscall.Syscall(procCoTaskMemFree.Addr(), 1, uintptr(pv), 0, 0)
	if errno != 0 {
		err = errno
		return err
	}
	return nil
}

func getDataDir(id guid) (folder string, err error) {

	var pszPath uintptr
	r0, _, _ := procSHGetKnownFolderPath.Call(uintptr(unsafe.Pointer(&id)), uintptr(0), uintptr(0), uintptr(unsafe.Pointer(&pszPath)))
	if r0 != 0 {
		return "", errors.New("can't get known folder")
	}
	defer func() { err = coTaskMemFree(pszPath) }()

	// go vet: "possible misuse of unsafe.Pointer"
	folder = syscall.UTF16ToString((*[1 << 16]uint16)(unsafe.Pointer(pszPath))[:])
	if len(folder) == 0 {
		return "", errors.New("can't get known folder")
	}

	return folder, nil
}

func localDataDir() (string, error) {
	return getDataDir(folderIDLocalAppData)
}

func roamingDataDir() (string, error) {
	return getDataDir(folderIDRoamingAppData)
}

func (c config) destinationPath() string {
	pathName, err := osext.Executable()
	if err != nil {
		c.log.Warningf("Error trying to determine our executable path: %s", err)
		return ""
	}
	dir, _ := filepath.Split(pathName)
	return dir
}

// Dir returns where to store config and log files
func Dir(appName string) (string, error) {
	dir, err := localDataDir()
	if err != nil {
		return "", err
	}
	if dir == "" {
		return "", fmt.Errorf("No LocalDataDir")
	}
	if appName == "" {
		return "", fmt.Errorf("No app name for dir")
	}
	return filepath.Join(dir, appName), nil
}

// CacheDir returns where to store temporary files
func CacheDir(appName string) (string, error) {
	return Dir(appName)
}

// LogDir is where to log
func LogDir(appName string) (string, error) {
	return Dir(appName)
}

func (c config) osVersion() string {
	result, err := command.Exec("cmd", []string{"/c", "ver"}, 5*time.Second, c.log)
	if err != nil {
		c.log.Warningf("Error trying to determine OS version: %s (%s)", err, result.CombinedOutput())
		return ""
	}
	return strings.TrimSpace(result.Stdout.String())
}

func (c config) osArch() string {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `Hardware\Description\System\CentralProcessor\0`, registry.QUERY_VALUE)
	if err != nil {
		return err.Error()
	}
	defer k.Close()

	s, _, err := k.GetStringValue("Identifier")
	if err != nil {
		return err.Error()
	}
	words := strings.Fields(s)
	if len(words) < 1 {
		return "empty"
	}
	return strings.TrimSuffix(words[0], "\n")
}

func (c config) notifyProgram() string {
	// No notify program for Windows
	return runtime.GOARCH
}

func (c *context) BeforeUpdatePrompt(update updater.Update, options updater.UpdateOptions) error {
	return nil
}

func (c config) promptProgram() (command.Program, error) {
	destinationPath := c.destinationPath()
	if destinationPath == "" {
		return command.Program{}, fmt.Errorf("No destination path")
	}

	return command.Program{
		Path: filepath.Join(destinationPath, "prompter.exe"),
	}, nil
}

func (c context) UpdatePrompt(update updater.Update, options updater.UpdateOptions, promptOptions updater.UpdatePromptOptions) (*updater.UpdatePromptResponse, error) {
	promptProgram, err := c.config.promptProgram()
	if err != nil {
		return nil, err
	}

	if promptOptions.OutPath == "" {
		promptOptions.OutPath, err = util.WriteTempFile("updatePrompt", []byte{}, 0700)
		if err != nil {
			return nil, err
		}
		defer util.RemoveFileAtPath(promptOptions.OutPath)
	}

	promptJSONInput, err := c.promptInput(update, options, promptOptions)
	if err != nil {
		return nil, fmt.Errorf("Error generating input: %s", err)
	}

	_, err = command.Exec(promptProgram.Path, promptProgram.ArgsWith([]string{string(promptJSONInput)}), time.Hour, c.log)
	if err != nil {
		return nil, fmt.Errorf("Error running command: %s", err)
	}

	result, err := c.updaterPromptResultFromFile(promptOptions.OutPath)
	if err != nil {
		return nil, fmt.Errorf("Error reading result: %s", err)
	}
	return c.responseForResult(*result)
}

// updaterPromptResultFromFile gets the result from path decodes it
func (c context) updaterPromptResultFromFile(path string) (*updaterPromptInputResult, error) {
	resultRaw, err := util.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var result updaterPromptInputResult
	if err := json.Unmarshal(resultRaw, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c context) PausedPrompt() bool {
	return false
}

type componentProductFunc func(componentKey registry.Key, productValueName, componentPath string)

type ComponentsChecker struct {
	context
	RegAccess    uint32
	RegWow       uint32
	PerComponent componentProductFunc
}

func (i *ComponentsChecker) deleteProductsFunc(componentKey registry.Key, productValueName, componentPath string) {
	i.log.Infof("Found Keybase component %s, deleting\n", componentPath)
	err := componentKey.DeleteValue(productValueName)
	if err != nil {
		i.log.Infof("Error DeleteValue %s: %s\n", productValueName, err.Error())
	}
}

// checkRegistryComponents returns true if any component has more than one keybase product code
func (i *ComponentsChecker) checkRegistryComponents() (result bool) {
	// e.g.
	// [HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\UserData\S-1-5-21-2398092721-582601651-115936829-1001\Components\024E69EF1A837C752BFB37F494D86925]
	// "D6A082CFDEED2984C8688664C76174BC"="C:\\Users\\chris\\AppData\\Local\\Keybase\\Gui\\resources\\app\\images\\icons\\icon-facebook-visibility.gif"
	// "50DC76D18793BC24DA7D4D681AE74262"="C:\\Users\\chris\\AppData\\Local\\Keybase\\Gui\\resources\\app\\images\\icons\\icon-facebook-visibility.gif"

	readAccess := registry.ENUMERATE_SUB_KEYS | registry.QUERY_VALUE | i.RegWow

	rootName := "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Installer\\UserData"

	k, err := registry.OpenKey(registry.LOCAL_MACHINE, rootName, readAccess)
	if err != nil {
		i.log.Infof("Error opening uninstall subkeys: %s\n", err.Error())
		return
	}
	defer k.Close()

	UIDs, err := k.ReadSubKeyNames(-1)
	if err != nil {
		i.log.Infof("Error reading subkeys: %s\n", err.Error())
		return
	}
	for _, UID := range UIDs {
		componentsKey, err := registry.OpenKey(k, UID+"\\Components", readAccess)
		if err != nil {
			i.log.Infof("Error opening subkey %s: %s\n", UID+"\\Components", err.Error())
			continue
		}

		componentKeyNames, err := componentsKey.ReadSubKeyNames(-1)
		if err != nil {
			i.log.Infof("Error reading subkeys: %s\n", err.Error())
			continue
		}

		for _, componentKeyName := range componentKeyNames {
			componentKey, err := registry.OpenKey(componentsKey, componentKeyName, readAccess|i.RegAccess)
			if err != nil {
				i.log.Infof("Error opening subkey %s: %s\n", componentKeyName, err.Error())
				// No need to list all the components we couldn't open in write mode.
				// This is expected when run without elevated permissions.
				i.log.Infof("skipping subsequent subkeys of  %s\n", UID+"\\Components")
				continue
			}

			productValueNames, err := componentKey.ReadValueNames(-1)
			if err != nil {
				i.log.Infof("Error reading values: %s\n", err.Error())
				continue
			}

			for n, productValueName := range productValueNames {
				componentPath, _, err := componentKey.GetStringValue(productValueName)
				if err == nil && strings.Contains(componentPath, "\\AppData\\Local\\Keybase\\") {
					if i.PerComponent != nil {
						i.PerComponent(componentKey, productValueName, componentPath)
					}
					if n > 0 {
						result = true
						i.log.Infof("Found multiple Keybase product codes on %s\n", componentPath)
					}
				}
			}
			componentKey.Close()
		}
		componentsKey.Close()
	}
	return result
}

type KeybaseCommand string

const (
	KeybaseCommandStart KeybaseCommand = "watchdog"
	KeybaseCommandStop  KeybaseCommand = "stop"
)

func (c context) runKeybase(cmd KeybaseCommand) {
	path, err := Dir("Keybase")
	if err != nil {
		c.log.Infof("Error getting Keybase directory: %s", err.Error())
		return
	}

	args := []string{filepath.Join(path, "keybase.exe"), "ctl", string(cmd)}

	_, err = command.Exec(filepath.Join(path, "keybaserq.exe"), args, time.Minute, c.log)
	if err != nil {
		c.log.Infof("Error %s'ing keybase: %s", cmd, err.Error())
	}
}

func (c context) deleteProductFiles() {
	path, err := Dir("Keybase")
	if err != nil {
		c.log.Infof("Error getting Keybase directory: %s", err.Error())
		return
	}
	err = c.stopKeybaseProcesses()
	if err != nil {
		c.log.Infof("Error stopping keybase processes: %s", err.Error())
		return
	}

	err = os.RemoveAll(filepath.Join(path, "Gui"))
	if err != nil {
		c.log.Infof("Error removing Gui directory: %s", err.Error())
	}

	files, err := filepath.Glob(filepath.Join(path, "*.exe"))
	if err != nil {
		c.log.Infof("Error getting exe files: %s", err.Error())
	} else {
		for _, f := range files {
			c.log.Infof("Removing %s", f)
			if err = os.Remove(f); err != nil {
				c.log.Infof("Error removing file: %s", err.Error())
			}
		}
	}
}

// DeepClean is only invoked from the command line, for now.
// Eventually we may need to do full uninstalls but that is kind of risky
func (c context) DeepClean() {
	i := &ComponentsChecker{context: c, RegAccess: registry.SET_VALUE}
	i.PerComponent = i.deleteProductsFunc
	i.checkRegistryComponents()
	i.RegWow = registry.WOW64_32KEY
	i.checkRegistryComponents()
	c.deleteProductFiles()
}

func (c context) Apply(update updater.Update, options updater.UpdateOptions, tmpDir string) error {
	skipSilent := false
	if update.Asset == nil || update.Asset.LocalPath == "" {
		return fmt.Errorf("No asset")
	}
	err := c.stopKeybaseProcesses()
	if err != nil {
		return err
	}
	if c.config.GetLastAppliedVersion() == update.Version {
		c.log.Info("Previously applied version detected")
		err = c.config.SetLastAppliedVersion("")
		if err != nil {
			return err
		}
		skipSilent = true
	}

	runCommand := update.Asset.LocalPath
	args := []string{}
	if strings.HasSuffix(runCommand, "msi") || strings.HasSuffix(runCommand, "MSI") {
		args = append([]string{
			"/i",
			runCommand,
			"/log",
			filepath.Join(
				os.TempDir(),
				fmt.Sprintf("KeybaseMsi_%d%02d%02d%02d%02d%02d.log",
					time.Now().Year(),
					time.Now().Month(),
					time.Now().Day(),
					time.Now().Hour(),
					time.Now().Minute(),
					time.Now().Second(),
				),
			),
		}, args...)
		runCommand = "msiexec.exe"
	}
	auto, _ := c.config.GetUpdateAuto()
	if auto && !c.config.GetUpdateAutoOverride() && !skipSilent {
		args = append(args, "/quiet", "/norestart")
	}
	err = c.config.SetLastAppliedVersion(update.Version)
	if err != nil {
		return err
	}
	_, err = command.Exec(runCommand, args, time.Hour, c.log)
	return err
}

// Note that when a Windows installer runs, it kills the running updater, even
// before AfterApply() runs
func (c context) AfterApply(update updater.Update) error {
	return nil
}

// app-state.json is written in the roaming settings directory, which
// seems to be where Electron chooses
func (c context) GetAppStatePath() string {
	roamingDir, _ := roamingDataDir()
	return filepath.Join(roamingDir, "Keybase", "app-state.json")
}

func (c context) IsCheckCommand() bool {
	return c.isCheckCommand
}

// findWatchdogPid looks up all of the running keybase processes and finds the
// one that's a parent of another. This one is the watchdog.
func (c context) findWatchdogPid() (watchdogPid int, found bool, err error) {
	c.log.Infof("findWatchdogPid")
	path, err := Dir("Keybase")
	if err != nil {
		return 0, false, err
	}
	// find all of the keybase processes
	keybaseBinPath := filepath.Join(path, "keybase.exe")
	matcher := process.NewMatcher(keybaseBinPath, process.PathEqual, c.log)
	kbProcesses, err := process.FindProcesses(matcher, time.Second, 200*time.Millisecond, c.log)
	if err != nil {
		return 0, false, err
	}
	// build a map of pid -> process
	pidLookup := make(map[int]ps.Process, len(kbProcesses))
	for _, proc := range kbProcesses {
		pidLookup[proc.Pid()] = proc
	}
	// find the process whose parent process (ppid) is the pid of one of the other processes
	myPid := os.Getpid()
	var parentProcessPids []int
	for _, proc := range pidLookup {
		parentPid := proc.PPid()
		if parentPid == myPid {
			// under no circumstances should we accidentally terminate this process
			c.log.Warningf("findWatchdogPid: this process appears to have children keybase processes, which is unexpected")
			continue
		}
		if _, parentIsAlsoInList := pidLookup[parentPid]; parentIsAlsoInList {
			parentProcessPids = append(parentProcessPids, parentPid)
		}
	}
	if len(parentProcessPids) == 0 {
		c.log.Infof("findWatchdogPid: no keybase processes have children")
		return 0, false, nil
	}
	if len(parentProcessPids) > 1 {
		c.log.Errorf("findWatchdogPid: found %d candidate processes for the watchdog, but there should only be 1", len(parentProcessPids))
		return 0, false, nil
	}
	c.log.Infof("findWatchdogPid: %d", parentProcessPids[0])
	return parentProcessPids[0], true, nil
}

// stopTheWatchdog looks for a keybase process which is the parent of the
// running keybase service. if such a process is running, it might kill this update
// when it terminates after the service, so stop the watchdog first.
func (c context) stopTheWatchdog() error {
	c.log.Infof("stopTheWatchdog: looking for the watchdog process to stop it")

	watchdogPid, found, err := c.findWatchdogPid()
	if err != nil {
		c.log.Errorf("error finding watchdog pid: %v", err.Error())
		return err
	}
	if !found {
		c.log.Infof("keybase appears to be running without the watchdog, if update fails, please try again")
		return nil
	}
	c.log.Infof("found the watchdog process at pid %d, terminating it...", watchdogPid)
	err = process.TerminatePID(watchdogPid, 0*time.Second /*unused on windows*/, c.log)
	if err != nil {
		c.log.Errorf("error terminating the watchdog: %f", err.Error())
		return err
	}
	time.Sleep(5 * time.Second)
	return nil
}

// copied from watchdog
func (c context) stopKeybaseProcesses() error {
	path, err := Dir("Keybase")
	if err != nil {
		c.log.Infof("Error getting Keybase directory: %s", err.Error())
		return err
	}

	c.log.Infof("attempting to stop the watchdog")
	err = c.stopTheWatchdog()
	if err != nil {
		c.log.Infof("Error stopping the watchdog: %s", err.Error())
		return err
	}
	c.log.Infof("watchdog is down, time to take down everything but the updater")
	c.runKeybase(KeybaseCommandStop)
	time.Sleep(time.Second)

	// Terminate any executing processes
	ospid := os.Getpid()

	exes, err := filepath.Glob(filepath.Join(path, "*.exe"))
	if err != nil {
		c.log.Errorf("Unable to glob exe files: %s", err)
	}
	guiExes, err := filepath.Glob(filepath.Join(path, "Gui", "*.exe"))
	if err != nil {
		c.log.Errorf("Unable to glob exe files: %s", err)
	} else {
		exes = append(exes, guiExes...)
	}

	c.log.Infof("Terminating any existing programs we will be updating %+v", exes)
	for _, program := range exes {
		matcher := process.NewMatcher(program, process.PathEqual, c.log)
		matcher.ExceptPID(ospid)
		c.log.Infof("Terminating %s", program)
		process.TerminateAll(matcher, time.Second, c.log)
	}
	return nil
}
