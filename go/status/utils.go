// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package status

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func getPlatformInfo() keybase1.PlatformInfo {
	return keybase1.PlatformInfo{
		Os:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		GoVersion: runtime.Version(),
	}
}

// DirSize walks the file tree the size of the given directory
func DirSize(dirPath string) (size uint64, numFiles int, err error) {
	err = filepath.Walk(dirPath, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += uint64(info.Size())
			numFiles++
		}
		return nil
	})
	return size, numFiles, err
}

func CacheSizeInfo(g *libkb.GlobalContext) (info []keybase1.DirSizeInfo, err error) {
	cacheDir := g.GetCacheDir()
	files, err := ioutil.ReadDir(cacheDir)
	if err != nil {
		return nil, err
	}

	var totalSize uint64
	var totalFiles int
	for _, file := range files {
		if !file.IsDir() {
			totalSize += uint64(file.Size())
			continue
		}
		dirPath := filepath.Join(cacheDir, file.Name())
		size, numFiles, err := DirSize(dirPath)
		if err != nil {
			return nil, err
		}
		totalSize += size
		totalFiles += numFiles
		info = append(info, keybase1.DirSizeInfo{
			Name:      dirPath,
			NumFiles:  numFiles,
			HumanSize: humanize.Bytes(size),
		})
	}
	info = append(info, keybase1.DirSizeInfo{
		Name:      cacheDir,
		NumFiles:  totalFiles,
		HumanSize: humanize.Bytes(totalSize),
	})
	return info, nil
}

// execToString returns the space-trimmed output of a command or an error.
func execToString(bin string, args []string) (string, error) {
	result, err := exec.Command(bin, args...).Output()
	if err != nil {
		return "", err
	}
	if result == nil {
		return "", fmt.Errorf("Nil result")
	}
	return strings.TrimSpace(string(result)), nil
}

func GetFirstClient(v []keybase1.ClientStatus, typ keybase1.ClientType) *keybase1.ClientDetails {
	for _, cli := range v {
		if cli.Details.ClientType == typ {
			return &cli.Details
		}
	}
	return nil
}
