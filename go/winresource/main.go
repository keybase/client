// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is a utility which binds to libkb to get the correct version
// for printing out or generating compiled resources for the windows
// executlable.

// +build windows

package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/josephspurrier/goversioninfo"
	"github.com/keybase/client/go/libkb"
)

func GetBuildName() string {
	// Todo: use regular build number when not doing prerelease

	gitHash, err := exec.Command("cmd", "/C", "git", "log", "-1", "--pretty=format:%h").Output()
	if err != nil {
		log.Print("Error generating githash", err)
		os.Exit(3)
	}

	return fmt.Sprintf("%d%02d%02d%02d%02d%02d+%s", time.Now().Year(), time.Now().Month(), time.Now().Day(), time.Now().Hour(), time.Now().Minute(), time.Now().Second(), gitHash)

}

// Create the syso and custom build file
func main() {

	outPtr := flag.String("o", "rsrc_windows.syso", "resource output pathname")
	printverPtr := flag.Bool("v", false, "print version to console (no .syso output)")
	printCustomVerPtr := flag.Bool("cv", false, "print custom version to console (no .syso output)")
	printCustomBuildPtr := flag.Bool("cb", false, "print custom build number to console (no .syso output)")
	printWinVerPtr := flag.Bool("w", false, "print windows format version to console (no .syso output)")
	iconPtr := flag.String("i", "../../packaging/windows/keybase.ico", "icon pathname")

	flag.Parse()

	var fv goversioninfo.FileVersion

	if int, err := fmt.Sscanf(libkb.Version, "%d.%d.%d", &fv.Major, &fv.Minor, &fv.Patch); int != 3 || err != nil {
		log.Printf("Error parsing version %v", err)
		os.Exit(3)
	}

	// Ugly special case hack: fv.Build went from 1 to 0 at 1.0.14, which makes Windows
	// think it's a downgrade (1.0.14.1 -> 1.0.14.0), so artificially bump build until we
	// get past 1.0.14
	if fv.Major == 1 && fv.Minor == 0 && fv.Patch == 14 {
		fv.Build = 1
	}

	semVer := fmt.Sprintf("%d.%d.%d-%d", fv.Major, fv.Minor, fv.Patch, fv.Build)

	if *printverPtr {
		fmt.Print(semVer)
		return
	}

	if *printWinVerPtr {
		fmt.Printf("%d.%d.%d.%d", fv.Major, fv.Minor, fv.Patch, fv.Build)
		return
	}

	if *printCustomVerPtr {
		customVer := fmt.Sprintf("%d.%d.%d-%s", fv.Major, fv.Minor, fv.Patch, GetBuildName())
		fmt.Print(customVer)
		return
	}

	if *printCustomBuildPtr {
		fmt.Printf("%s", GetBuildName())
		return
	}

	// Create a new container
	vi := &goversioninfo.VersionInfo{
		FixedFileInfo: goversioninfo.FixedFileInfo{
			FileVersion:    fv,
			ProductVersion: fv,
			FileFlagsMask:  "3f",
			FileFlags:      "00",
			FileOS:         "040004",
			FileType:       "01",
			FileSubType:    "00",
		},
		StringFileInfo: goversioninfo.StringFileInfo{
			CompanyName:      "Keybase, Inc.",
			FileDescription:  "Keybase utility",
			InternalName:     "Keybase",
			LegalCopyright:   "Copyright (c) 2015, Keybase",
			OriginalFilename: "keybase.exe",
			ProductName:      "Keybase",
			ProductVersion:   libkb.VersionString(),
		},
		VarFileInfo: goversioninfo.VarFileInfo{
			Translation: goversioninfo.Translation{
				LangID:    0x409, // english
				CharsetID: 0x4B0, // unicode
			},
		},
	}

	// Fill the structures with config data
	vi.Build()

	// Write the data to a buffer
	vi.Walk()

	// Optionally, embed an icon by path
	// If the icon has multiple sizes, all of the sizes will be embedded
	vi.IconPath = *iconPtr

	// Create the file
	if err := vi.WriteSyso(*outPtr); err != nil {
		log.Printf("Error writing %s: %v", *outPtr, err)
		os.Exit(3)
	}

}
