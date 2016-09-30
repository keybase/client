package client

import (
	"errors"
	"syscall"
	"unsafe"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
func (c *CmdWatchdog2) setDefaultMountDir() error {
	drive, err := getDriveLetter(c.G().Log)
	if err != nil {
		return err
	}
	cli, err := GetConfigClient(c.G())
	if err != nil {
		return err
	}
	V := keybase1.ConfigValue{IsNull: false, S: &drive}
	err = cli.SetValue(context.TODO(), keybase1.SetValueArg{Path: "mountdir", Value: V})
	return err
}
