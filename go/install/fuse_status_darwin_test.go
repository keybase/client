// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin && !ios

package install

import (
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-kext"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sys/unix"
)

func TestFindStringInPlist(t *testing.T) {
	const plistTestData = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
  	<key>CFBundleName</key>
  	<string>Keybase</string>
  	<key>CFBundleVersion</key>
  	<string>1.0.17-20160825110028+67f6e3b</string>
  	<key>NSMainNibFile</key>
  	<string>MainMenu</string>
  </dict>
  </plist>`
	version := findStringInPlist("CFBundleVersion", []byte(plistTestData), testLog)
	assert.Equal(t, "1.0.17-20160825110028+67f6e3b", version)
}

func TestFindStringInPlistWithWhitespace(t *testing.T) {
	const plistTestData = `    <key> test </key>` + "\n\n \t" + `  <string> value </string>  ` + "\n\t"
	value := findStringInPlist(" test ", []byte(plistTestData), testLog)
	assert.Equal(t, " value ", value)
}

func TestFindStringInPlistWithNoWhitespace(t *testing.T) {
	const plistTestData = `<key>test</key><string>value</string>`
	value := findStringInPlist("test", []byte(plistTestData), testLog)
	assert.Equal(t, "value", value)
}

func TestDeriveFuseStatus(t *testing.T) {
	started := &kext.Info{Version: "5.4.0", Started: true}
	stopped := &kext.Info{Version: "5.4.0", Started: false}
	cases := []struct {
		name        string
		probe       macfuseProbe
		status      keybase1.InstallStatus
		action      keybase1.InstallAction
		code        int
		desc        string
		version     string
		kextID      string
		kextStarted bool
	}{
		{
			name: "not installed", probe: macfuseProbe{},
			status: keybase1.InstallStatus_NOT_INSTALLED, action: keybase1.InstallAction_INSTALL, desc: msgNotInstalled,
		},
		{
			name: "not installed beats plist error", probe: macfuseProbe{PlistErr: errors.New("x")},
			status: keybase1.InstallStatus_NOT_INSTALLED, action: keybase1.InstallAction_INSTALL, desc: msgNotInstalled,
		},
		{
			name: "plist error", probe: macfuseProbe{BundleExists: true, PlistErr: errors.New("unreadable")},
			status: keybase1.InstallStatus_ERROR, action: keybase1.InstallAction_REINSTALL, code: libkb.SCGeneric,
			desc: "Error reading the macFUSE version: unreadable",
		},
		{
			name: "garbage version", probe: macfuseProbe{BundleExists: true, PlistVersion: "garbage"},
			status: keybase1.InstallStatus_ERROR, action: keybase1.InstallAction_REINSTALL, code: libkb.SCGeneric,
		},
		{
			name: "empty version", probe: macfuseProbe{BundleExists: true},
			status: keybase1.InstallStatus_ERROR, action: keybase1.InstallAction_REINSTALL, code: libkb.SCGeneric,
		},
		{
			name: "outdated", probe: macfuseProbe{BundleExists: true, PlistVersion: "4.8.0", KextInfo: started},
			status: keybase1.InstallStatus_INSTALLED, action: keybase1.InstallAction_UPGRADE,
			desc: "macFUSE 4.8.0 is installed, but Keybase needs macFUSE 5 or later. Update it from https://macfuse.io", version: "4.8.0",
		},
		{
			name: "outdated beats kext error", probe: macfuseProbe{BundleExists: true, PlistVersion: "4.8.0", KextInfoErr: errors.New("x")},
			status: keybase1.InstallStatus_INSTALLED, action: keybase1.InstallAction_UPGRADE,
			desc: "macFUSE 4.8.0 is installed, but Keybase needs macFUSE 5 or later. Update it from https://macfuse.io", version: "4.8.0",
		},
		{
			name: "kext error", probe: macfuseProbe{BundleExists: true, PlistVersion: "5.0.6", KextInfoErr: errors.New("iokit")},
			status: keybase1.InstallStatus_ERROR, action: keybase1.InstallAction_NONE, code: libkb.SCGeneric,
			desc: "Error loading kext info: iokit", version: "5.0.6",
		},
		{
			name: "ready, two-part version, not loaded", probe: macfuseProbe{BundleExists: true, PlistVersion: "5.0"},
			status: keybase1.InstallStatus_INSTALLED, action: keybase1.InstallAction_NONE, version: "5.0",
		},
		{
			name: "ready, loaded but stopped", probe: macfuseProbe{BundleExists: true, PlistVersion: "5.0.6", KextID: "io.macfuse.filesystems.macfuse.25", KextInfo: stopped},
			status: keybase1.InstallStatus_INSTALLED, action: keybase1.InstallAction_NONE, version: "5.0.6", kextID: "io.macfuse.filesystems.macfuse.25",
		},
		{
			name: "ready, started", probe: macfuseProbe{BundleExists: true, PlistVersion: "5.4.0", KextID: "io.macfuse.filesystems.macfuse.25", KextInfo: started},
			status: keybase1.InstallStatus_INSTALLED, action: keybase1.InstallAction_NONE, version: "5.4.0", kextID: "io.macfuse.filesystems.macfuse.25", kextStarted: true,
		},
	}
	for _, tc := range cases {
		for _, legacy := range []bool{false, true} {
			probe := tc.probe
			probe.LegacyKbfuse = legacy
			st := deriveFuseStatus(probe)
			require.Equal(t, tc.status, st.InstallStatus, tc.name)
			require.Equal(t, tc.action, st.InstallAction, tc.name)
			require.Equal(t, tc.code, st.Status.Code, tc.name)
			if tc.desc != "" {
				require.Equal(t, tc.desc, st.Status.Desc, tc.name)
			}
			if tc.code != 0 {
				require.Equal(t, "INSTALL_ERROR", st.Status.Name, tc.name)
			}
			require.Equal(t, tc.version, st.Version, tc.name)
			require.Equal(t, tc.kextID, st.KextID, tc.name)
			require.Equal(t, tc.kextStarted, st.KextStarted, tc.name)
			if tc.probe.BundleExists {
				require.Equal(t, macfusePath, st.Path, tc.name)
			} else {
				require.Empty(t, st.Path, tc.name)
			}
			if legacy {
				require.Equal(t, []keybase1.StringKVPair{{Key: "legacyKbfuse", Value: legacyKbfusePath}}, st.Status.Fields, tc.name)
			} else {
				require.Empty(t, st.Status.Fields, tc.name)
			}
		}
	}
}

func statfs(from, on, fstype string, owner uint32) unix.Statfs_t {
	var m unix.Statfs_t
	copy(m.Mntfromname[:], from)
	copy(m.Mntonname[:], on)
	copy(m.Fstypename[:], fstype)
	m.Owner = owner
	return m
}

func TestMountInfosOwnedBy(t *testing.T) {
	mounts := []unix.Statfs_t{
		statfs("/dev/disk3s1s1", "/", "apfs", 0),
		statfs("kbfs@macfuse0", "/Volumes/Keybase (testuser)", "macfuse", 501),
		statfs("kbfs@macfuse1", "/Volumes/Keybase (testuser-mac)", "macfuse", 502),
		statfs("kbfs@kbfuse0", "/Volumes/Keybase", "kbfuse", 0),
		statfs("kbfs@kbfuse1", "/Volumes/Keybase (old)", "kbfuse", 501),
	}
	require.Equal(t, []keybase1.FuseMountInfo{
		{Fstype: "macfuse", Path: "/Volumes/Keybase (testuser)", Output: "kbfs@macfuse0 on /Volumes/Keybase (testuser) (macfuse)"},
		{Fstype: "kbfuse", Path: "/Volumes/Keybase (old)", Output: "kbfs@kbfuse1 on /Volumes/Keybase (old) (kbfuse)"},
	}, mountInfosOwnedBy(mounts, []string{"macfuse", "kbfuse"}, 501))
	require.Empty(t, mountInfosOwnedBy(mounts, []string{"macfuse"}, 503))
	require.Empty(t, mountInfosOwnedBy(nil, []string{"macfuse"}, 501))
}

func TestListMounts(t *testing.T) {
	mounts, err := listMounts()
	require.NoError(t, err)
	var paths []string
	for _, m := range mounts {
		paths = append(paths, unix.ByteSliceToString(m.Mntonname[:]))
	}
	require.Contains(t, paths, "/")
}

func TestFilterKBFSMountInfos(t *testing.T) {
	st := keybase1.FuseStatus{MountInfos: []keybase1.FuseMountInfo{
		{Fstype: "macfuse", Path: "/Volumes/remote"},
		{Fstype: "macfuse", Path: "/Volumes/Keybase (testuser)"},
		{Fstype: "kbfuse", Path: "/Volumes/Keybase (testuser-mac)"},
	}}
	FilterKBFSMountInfos(&st, "/Volumes/Keybase (testuser)/")
	require.Equal(t, []keybase1.FuseMountInfo{{Fstype: "macfuse", Path: "/Volumes/Keybase (testuser)"}}, st.MountInfos)
	FilterKBFSMountInfos(&st, "")
	require.Empty(t, st.MountInfos)
}
