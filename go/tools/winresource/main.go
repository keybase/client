// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is a utility which binds to libkb to get the correct version
// for printing out or generating compiled resources for the windows
// executable.

// +build windows

package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"reflect"
	"time"

	"strconv"

	"github.com/akavel/rsrc/binutil"
	"github.com/akavel/rsrc/coff"
	"github.com/josephspurrier/goversioninfo"
	"github.com/keybase/client/go/libkb"
)

func getBuildName() string {
	// Todo: use regular build number when not doing prerelease

	gitHash, err := exec.Command("cmd", "/C", "git", "log", "-1", "--pretty=format:%h").Output()
	if err != nil {
		log.Print("Error generating githash", err)
		os.Exit(3)
	}

	return fmt.Sprintf("%d%02d%02d%02d%02d%02d+%s", time.Now().Year(), time.Now().Month(), time.Now().Day(), time.Now().Hour(), time.Now().Minute(), time.Now().Second(), gitHash)

}

// kbWriteSyso creates a resource file from the version info and optionally an icon.
// arch must be an architecture string accepted by coff.Arch, like "386" or "amd64"
// Note this is partially lifted from josephspurrier/goversioninfo, which we
// extend here to write multiple icons.
func kbWriteSyso(vi *goversioninfo.VersionInfo, filename string, arch string, icons []string) error {

	// Channel for generating IDs
	newID := make(chan uint16)
	go func() {
		for i := uint16(1); ; i++ {
			newID <- i
		}
	}()

	// Create a new RSRC section
	coff := coff.NewRSRC()

	// Set the architechture
	err := coff.Arch(arch)
	if err != nil {
		return err
	}

	// ID 16 is for Version Information
	coff.AddResource(16, 1, goversioninfo.SizedReader{&vi.Buffer})

	// NOTE: if/when we start using a manifest, it goes here

	// If icon is enabled
	if vi.IconPath != "" {
		if err := addIcon(coff, vi.IconPath, newID); err != nil {
			return err
		}
	}
	// if extra icons were passed in
	for _, i := range icons {
		if i != "" {
			if err := addIcon(coff, i, newID); err != nil {
				return err
			}
		}
	}

	coff.Freeze()

	// Write to file
	return writeCoff(coff, filename)
}

// From josephspurrier/goversioninfo
func writeCoff(coff *coff.Coff, fnameout string) error {
	out, err := os.Create(fnameout)
	if err != nil {
		return err
	}
	if err = writeCoffTo(out, coff); err != nil {
		return fmt.Errorf("error writing %q: %v", fnameout, err)
	}
	return nil
}

// From josephspurrier/goversioninfo
func writeCoffTo(w io.WriteCloser, coff *coff.Coff) error {
	bw := binutil.Writer{W: w}

	// write the resulting file to disk
	binutil.Walk(coff, func(v reflect.Value, path string) error {
		if binutil.Plain(v.Kind()) {
			bw.WriteLE(v.Interface())
			return nil
		}
		vv, ok := v.Interface().(binutil.SizedReader)
		if ok {
			bw.WriteFromSized(vv)
			return binutil.WALK_SKIP
		}
		return nil
	})

	err := bw.Err
	if closeErr := w.Close(); closeErr != nil && err == nil {
		err = closeErr
	}
	return err
}

// Create the syso and custom build file
func main() {

	outPtr := flag.String("o", "rsrc_windows.syso", "resource output pathname")
	printverPtr := flag.Bool("v", false, "print version to console (no .syso output)")
	printCustomVerPtr := flag.Bool("cv", false, "print custom version to console (no .syso output)")
	printCustomBuildPtr := flag.Bool("cb", false, "print custom build number to console (no .syso output)")
	printWinVerPtr := flag.Bool("w", false, "print windows format version to console (no .syso output)")
	iconPtr := flag.String("i", "../../media/icons/Keybase.ico", "icon pathname")
	kbfsIconPtr := flag.String("kbfsicon", "", "icon pathname")
	fileDescriptionPtr := flag.String("d", "Keybase utility", "File Description")
	originalFilenamePtr := flag.String("n", "keybase.exe", "File name")

	flag.Parse()

	var fv goversioninfo.FileVersion

	if int, err := fmt.Sscanf(libkb.Version, "%d.%d.%d", &fv.Major, &fv.Minor, &fv.Patch); int != 3 || err != nil {
		log.Printf("Error parsing version %v", err)
		os.Exit(3)
	}

	fv.Build, _ = strconv.Atoi(os.Getenv("KEYBASE_WINBUILD"))
	if fv.Build == 0 && libkb.PrereleaseBuild != "" {
		fv.Build, _ = strconv.Atoi(libkb.PrereleaseBuild)
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
		customVer := fmt.Sprintf("%d.%d.%d-%s", fv.Major, fv.Minor, fv.Patch, getBuildName())
		fmt.Print(customVer)
		return
	}

	if *printCustomBuildPtr {
		fmt.Printf("%s", getBuildName())
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
			FileDescription:  *fileDescriptionPtr,
			InternalName:     "Keybase",
			LegalCopyright:   "Copyright (c) 2017, Keybase",
			OriginalFilename: *originalFilenamePtr,
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
	if err := kbWriteSyso(vi, *outPtr, "386", []string{*kbfsIconPtr}); err != nil {
		log.Printf("Error writing %s: %v", *outPtr, err)
		os.Exit(3)
	}

}
