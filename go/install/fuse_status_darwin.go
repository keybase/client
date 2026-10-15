// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin && !ios

package install

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/blang/semver"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/mounter"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-kext"
)

const (
	minMacfuseMajor = 5

	msgNotInstalled = "macFUSE is not installed. To use Keybase in Finder, install macFUSE 5 or later from https://macfuse.io"
	msgOutdated     = "macFUSE %s is installed, but Keybase needs macFUSE 5 or later. Update it from https://macfuse.io"
)

// macfuseProbe is what KeybaseFuseStatus reads from the system.
type macfuseProbe struct {
	BundleExists bool
	PlistErr     error
	PlistVersion string
	// KextID is the bundle ID of the loaded macFUSE kext. macFUSE ships one
	// kext per macOS version, each with its own ID suffix.
	KextID       string
	KextInfo     *kext.Info
	KextInfoErr  error
	LegacyKbfuse bool
}

// KeybaseFuseStatus returns the status of the stock macFUSE install. The
// bundle version is ignored on macOS.
func KeybaseFuseStatus(_ string, log Log) keybase1.FuseStatus {
	st := deriveFuseStatus(probeMacfuse(log))
	out, err := exec.Command("/sbin/mount").Output()
	if err != nil {
		log.Errorf("Error trying to read mount info: %s", err)
		return st
	}
	for _, fstype := range mounter.KBFSFstypes {
		st.MountInfos = append(st.MountInfos, parseMountOutput(fstype, string(out))...)
	}
	return st
}

// FilterKBFSMountInfos keeps only the mount at the user's KBFS mount
// directory, since other apps mount with fstype macfuse too.
func FilterKBFSMountInfos(st *keybase1.FuseStatus, mountDir string) {
	var kept []keybase1.FuseMountInfo
	for _, info := range st.MountInfos {
		if info.Path == mountDir {
			kept = append(kept, info)
		}
	}
	st.MountInfos = kept
}

func probeMacfuse(log Log) macfuseProbe {
	p := macfuseProbe{}
	if _, err := os.Stat(legacyKbfusePath); err == nil {
		p.LegacyKbfuse = true
	}
	if _, err := os.Stat(macfusePath); err != nil {
		return p
	}
	p.BundleExists = true
	plistData, err := loadPlist(filepath.Join(macfusePath, "Contents/Info.plist"), log)
	if err != nil {
		p.PlistErr = err
		return p
	}
	p.PlistVersion = findStringInPlist("CFBundleShortVersionString", plistData, log)
	if p.PlistVersion == "" {
		p.PlistVersion = findStringInPlist("CFBundleVersion", plistData, log)
	}
	p.KextID, p.KextInfo, p.KextInfoErr = loadedMacfuseKext(log)
	return p
}

// loadedMacfuseKext returns the ID and info of whichever of the bundle's kexts
// is loaded, or nil info if none is.
func loadedMacfuseKext(log Log) (string, *kext.Info, error) {
	plists, err := filepath.Glob(filepath.Join(macfusePath, "Contents/Extensions/*/macfuse.kext/Contents/Info.plist"))
	if err != nil {
		return "", nil, err
	}
	seen := map[string]bool{}
	for _, plistPath := range plists {
		plistData, err := loadPlist(plistPath, log)
		if err != nil {
			continue
		}
		kextID := findStringInPlist("CFBundleIdentifier", plistData, log)
		if kextID == "" || seen[kextID] {
			continue
		}
		seen[kextID] = true
		info, err := kext.LoadInfo(kextID)
		if err != nil {
			return kextID, nil, err
		}
		if info != nil {
			return kextID, info, nil
		}
	}
	return "", nil, nil
}

// deriveFuseStatus maps a probe to a status. The first matching case wins.
func deriveFuseStatus(p macfuseProbe) keybase1.FuseStatus {
	st := keybase1.FuseStatus{}
	if p.BundleExists {
		st.Path = macfusePath
	}
	var version semver.Version
	var versionErr error
	if p.BundleExists && p.PlistErr == nil {
		version, versionErr = semver.ParseTolerant(p.PlistVersion)
	}
	switch {
	case !p.BundleExists:
		st.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		st.InstallAction = keybase1.InstallAction_INSTALL
		st.Status = keybase1.Status{Desc: msgNotInstalled}
	case p.PlistErr != nil || versionErr != nil:
		err := p.PlistErr
		if err == nil {
			err = fmt.Errorf("invalid macFUSE version %q: %w", p.PlistVersion, versionErr)
		}
		st.InstallStatus = keybase1.InstallStatus_ERROR
		st.InstallAction = keybase1.InstallAction_REINSTALL
		st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: fmt.Sprintf("Error reading the macFUSE version: %s", err)}
	case version.Major < minMacfuseMajor:
		st.InstallStatus = keybase1.InstallStatus_INSTALLED
		st.InstallAction = keybase1.InstallAction_UPGRADE
		st.Version = p.PlistVersion
		st.Status = keybase1.Status{Desc: fmt.Sprintf(msgOutdated, p.PlistVersion)}
	case p.KextInfoErr != nil:
		st.InstallStatus = keybase1.InstallStatus_ERROR
		st.InstallAction = keybase1.InstallAction_NONE
		st.Version = p.PlistVersion
		st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: fmt.Sprintf("Error loading kext info: %s", p.KextInfoErr)}
	default:
		st.InstallStatus = keybase1.InstallStatus_INSTALLED
		st.InstallAction = keybase1.InstallAction_NONE
		st.Version = p.PlistVersion
		st.KextID = p.KextID
		st.KextStarted = p.KextInfo != nil && p.KextInfo.Started
		st.Status = keybase1.StatusOK("")
	}
	if p.LegacyKbfuse {
		st.Status.Fields = append(st.Status.Fields, keybase1.StringKVPair{Key: "legacyKbfuse", Value: legacyKbfusePath})
	}
	return st
}

// parseMountOutput returns the mounts of the given fstype in /sbin/mount
// output, whose lines look like "<from> on <path> (<fstype>, <flags>...)".
// The path may contain spaces and parentheses.
func parseMountOutput(fstype, out string) []keybase1.FuseMountInfo {
	var infos []keybase1.FuseMountInfo
	for _, line := range strings.Split(out, "\n") {
		_, rest, found := strings.Cut(line, " on ")
		if !found {
			continue
		}
		optsStart := strings.LastIndex(rest, " (")
		if optsStart <= 0 || !strings.HasSuffix(rest, ")") {
			continue
		}
		opts := rest[optsStart+2 : len(rest)-1]
		lineFstype, _, _ := strings.Cut(opts, ",")
		if strings.TrimSpace(lineFstype) != fstype {
			continue
		}
		infos = append(infos, keybase1.FuseMountInfo{
			Fstype: fstype,
			Path:   rest[:optsStart],
			Output: line,
		})
	}
	return infos
}

func findStringInPlist(key string, plistData []byte, log Log) string {
	// Hack to parse plist, instead of parsing we'll use a regex
	res := fmt.Sprintf(`<key>%s<\/key>\s*<string>([\S ]+)<\/string>`, key)
	re := regexp.MustCompile(res)
	submatch := re.FindStringSubmatch(string(plistData))
	if len(submatch) == 2 {
		return submatch[1]
	}
	log.Debug("No key (%s) found", key)
	return ""
}

func loadPlist(plistPath string, log Log) ([]byte, error) {
	if _, err := os.Stat(plistPath); os.IsNotExist(err) {
		log.Debug("No plist found: %s", plistPath)
		return nil, err
	}
	log.Debug("Loading plist: %s", plistPath)
	plistFile, err := os.Open(plistPath)
	defer func() {
		if err := plistFile.Close(); err != nil {
			log.Debug("unable to close file: %s", err)
		}
	}()
	if err != nil {
		return nil, err
	}
	return io.ReadAll(plistFile)
}
