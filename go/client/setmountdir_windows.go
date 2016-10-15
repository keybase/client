// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-updater/watchdog"
	"golang.org/x/net/context"
)

func getVolumeName(RootPathName string) (string, error) {
	var VolumeNameBuffer = make([]uint16, syscall.MAX_PATH+1)
	var nVolumeNameSize = uint32(len(VolumeNameBuffer))
	var VolumeSerialNumber uint32
	var MaximumComponentLength uint32
	var FileSystemFlags uint32
	var FileSystemNameBuffer = make([]uint16, 255)
	var nFileSystemNameSize = syscall.MAX_PATH + 1

	kernel32, _ := syscall.LoadLibrary("kernel32.dll")
	getVolume, _ := syscall.GetProcAddress(kernel32, "GetVolumeInformationW")

	var nargs uintptr = 8
	_, _, callErr := syscall.Syscall9(uintptr(getVolume),
		nargs,
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(RootPathName))),
		uintptr(unsafe.Pointer(&VolumeNameBuffer[0])),
		uintptr(nVolumeNameSize),
		uintptr(unsafe.Pointer(&VolumeSerialNumber)),
		uintptr(unsafe.Pointer(&MaximumComponentLength)),
		uintptr(unsafe.Pointer(&FileSystemFlags)),
		uintptr(unsafe.Pointer(&FileSystemNameBuffer[0])),
		uintptr(nFileSystemNameSize),
		0)

	if callErr != 0 {
		return "", callErr
	}

	return syscall.UTF16ToString(VolumeNameBuffer), nil
}

func getDriveLetter(log logger.Logger) (string, error) {
	kernel32, _ := syscall.LoadDLL("kernel32.dll")
	getLogicalDrivesHandle, _ := kernel32.FindProc("GetLogicalDrives")

	hr, _, errNo := getLogicalDrivesHandle.Call()
	if hr == 0 {
		log.Info("getLogicalDrivesHandle error (using K): %v\n", errNo)
		return "K:", errNo
	}

	// start at "K"
	for i := uint(10); i < 26; i++ {
		path := string(byte('A')+byte(i)) + ":"
		if hr&(1<<i) != 0 {
			volume, _ := getVolumeName(path + "\\")
			// sanity check that it isn't keybase already
			// Assume that no volume name means we can use it,
			// including errors retrieving same.
			// (we plan to change from KBFS to Keybase)
			if len(volume) > 0 && volume != "KBFS" && volume != "Keybase" {
				log.Info("Drive %s occupied by %s\n", path, volume)
				continue
			}
		}
		log.Info("Setting default KBFS mount to %s\n", path)
		return path, nil
	}
	log.Error("no drive letters left, using K as default")
	return "K:", errors.New("no drive letters left, using K as default")

}

// This makes a guess about what letter to use, starting at K,
// and saving it in the settings.
// Assume the caller has tested whether "mountdir" is set
func probeForAvailableMountDir(G *libkb.GlobalContext) (string, error) {
	G.Log.Info("probeForAvailableMountDir\n")
	drive, err := getDriveLetter(G.Log)
	if err != nil {
		return "", err
	}
	cli, err := GetConfigClient(G)
	if err != nil {
		return "", err
	}
	V := keybase1.ConfigValue{IsNull: false, S: &drive}
	err = cli.SetValue(context.TODO(), keybase1.SetValueArg{Path: "mountdir", Value: V})
	return drive, err
}

// Program is a program at path with arguments
type KBFSProgram struct {
	libkb.Contextified
	Path     string
	mountDir string
}

func (p KBFSProgram) GetPath() string {
	return p.Path
}

func (p *KBFSProgram) GetArgs() []string {
	var err error
	p.mountDir, err = p.G().Env.GetMountDir()
	if err != nil || p.mountDir == "" {
		// for Windows
		p.mountDir, err = probeForAvailableMountDir(p.G())
	}
	p.G().Log.Info("KBFSProgram.GetArgs() - mount dir %s", p.mountDir)

	return []string{
		"-debug",
		"-log-to-file",
		p.mountDir,
	}
}

func (p KBFSProgram) GetExitOn() watchdog.ExitOn {
	return watchdog.ExitOnSuccess
}

func (p KBFSProgram) DoStop(ospid int, log watchdog.Log) {
	// open special "file". Errors not relevant.
	log.Debugf("KillKBFS: opening .kbfs_unmount")
	os.Open(filepath.Join(p.mountDir, ".kbfs_unmount"))
}

func GetkbfsProgram(G *libkb.GlobalContext, kbfsPath string) (watchdog.Program, error) {

	return &KBFSProgram{
		Contextified: libkb.NewContextified(G),
		Path:         kbfsPath,
	}, nil
}

func doMountDirChange(oldDir string) {
	// open special "file". Errors not relevant.
	os.Open(filepath.Join(oldDir, ".kbfs_unmount"))
}
