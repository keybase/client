// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"os/user"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/utils"
	"github.com/keybase/gomounts"
)

var kbfusePath = fuse.OSXFUSEPaths{
	DevicePrefix: "/dev/kbfuse",
	Load:         "/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse",
	Mount:        "/Library/Filesystems/kbfuse.fs/Contents/Resources/mount_kbfuse",
	DaemonVar:    "MOUNT_KBFUSE_DAEMON_PATH",
}

const (
	mountpointTimeout = 5 * time.Second
	notRunningName    = "KBFS_NOT_RUNNING"
	mountAsUser       = "root"
)

type symlink struct {
	link string
}

func (s symlink) Attr(ctx context.Context, a *fuse.Attr) (err error) {
	a.Mode = os.ModeSymlink | a.Mode | 0555
	a.Valid = 0
	return nil
}

func (s symlink) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (
	link string, err error) {
	return s.link, nil
}

type cacheEntry struct {
	mountpoint string
	time       time.Time
}

type root struct {
	runmodeStr      string
	runmodeStrFancy string

	lock            sync.RWMutex
	mountpointCache map[uint32]cacheEntry

	getMountsLock sync.Mutex

	shutdownCh chan struct{}
}

func newRoot() *root {
	runmodeStr := "keybase"
	runmodeStrFancy := "Keybase"
	switch os.Getenv("KEYBASE_RUN_MODE") {
	case "staging":
		runmodeStr = "keybase.staging"
		runmodeStrFancy = "KeybaseStaging"
	case "devel":
		runmodeStr = "keybase.devel"
		runmodeStrFancy = "KeybaseDevel"
	}

	return &root{
		runmodeStr:      runmodeStr,
		runmodeStrFancy: runmodeStrFancy,
		mountpointCache: make(map[uint32]cacheEntry),
		shutdownCh:      make(chan struct{}),
	}
}

func (r *root) Root() (fs.Node, error) {
	return r, nil
}

func (r *root) Attr(ctx context.Context, attr *fuse.Attr) error {
	attr.Mode = os.ModeDir | 0555
	return nil
}

func (r *root) getCachedMountpoint(uid uint32) string {
	r.lock.RLock()
	defer r.lock.RUnlock()
	entry, ok := r.mountpointCache[uid]
	if !ok {
		return ""
	}
	now := time.Now()
	if now.Sub(entry.time) > mountpointTimeout {
		// Don't bother deleting the entry, since the caller should
		// just overwrite it.
		return ""
	}
	return entry.mountpoint
}

func (r *root) getMountedVolumes() ([]gomounts.Volume, error) {
	r.getMountsLock.Lock()
	defer r.getMountsLock.Unlock()
	return gomounts.GetMountedVolumes()
}

// mountpointMatchesRunmode returns true if `mp` contains `runmode` at
// the end of a component of the path, or followed by a space.
func mountpointMatchesRunmode(mp, runmode string) bool {
	i := strings.Index(mp, runmode)
	if i < 0 {
		return false
	}
	if len(mp) == i+len(runmode) || mp[i+len(runmode)] == '/' ||
		mp[i+len(runmode)] == ' ' {
		return true
	}
	return false
}

func (r *root) findKBFSMount(ctx context.Context) (
	mountpoint string, err error) {
	// Get the UID, and crash intentionally if it's not set, because
	// that means we're not compiled against the correct version of
	// bazil.org/fuse.
	uid := ctx.Value(fs.CtxHeaderUIDKey).(uint32)
	// Don't let the root see anything here; we don't want a symlink
	// loop back to this mount.
	if uid == 0 {
		return "", fuse.ENOENT
	}

	mountpoint = r.getCachedMountpoint(uid)
	if mountpoint != "" {
		return mountpoint, nil
	}

	defer func() {
		if err != nil {
			return
		}
		// Cache the entry if we didn't hit an error.
		r.lock.Lock()
		defer r.lock.Unlock()
		r.mountpointCache[uid] = cacheEntry{
			mountpoint: mountpoint,
			time:       time.Now(),
		}
	}()

	u, err := user.LookupId(strconv.FormatUint(uint64(uid), 10))
	if err != nil {
		return "", err
	}

	vols, err := r.getMountedVolumes()
	if err != nil {
		return "", err
	}
	fuseType := "fuse"
	if runtime.GOOS == "darwin" {
		fuseType = "kbfuse"
	}
	var fuseMountPoints []string
	for _, v := range vols {
		if v.Type != fuseType {
			continue
		}
		if v.Owner != u.Uid {
			continue
		}
		fuseMountPoints = append(fuseMountPoints, v.Path)
	}

	if len(fuseMountPoints) == 0 {
		return "", fuse.ENOENT
	}

	// Pick the first one alphabetically that has "keybase" in the
	// path.
	sort.Strings(fuseMountPoints)
	for _, mp := range fuseMountPoints {
		// Find mountpoints like "/home/user/.local/share/keybase/fs",
		// or "/Volumes/Keybase (user)", and make sure it doesn't
		// match mounts for another run mode, say
		// "/Volumes/KeybaseStaging (user)".
		if mountpointMatchesRunmode(mp, r.runmodeStr) ||
			mountpointMatchesRunmode(mp, r.runmodeStrFancy) {
			return mp, nil
		}
	}

	// Give up.
	return "", fuse.ENOENT
}

func (r *root) ReadDirAll(ctx context.Context) ([]fuse.Dirent, error) {
	select {
	case <-r.shutdownCh:
		return nil, nil
	default:
	}

	_, err := r.findKBFSMount(ctx)
	if err != nil {
		if err == fuse.ENOENT {
			// Put a symlink in the directory for someone who's not
			// logged in, so that the directory is non-empty and
			// future redirector calls as root won't try to mount over
			// us.
			return []fuse.Dirent{
				{
					Type: fuse.DT_Link,
					Name: notRunningName,
				},
			}, nil
		}
		return []fuse.Dirent{}, err
	}

	// TODO: show the `kbfs.error.txt" and "kbfs.nologin.txt" files if
	// they exist?  As root, it is hard to figure out if they're
	// there, though.
	return []fuse.Dirent{
		{
			Type: fuse.DT_Link,
			Name: "private",
		},
		{
			Type: fuse.DT_Link,
			Name: "public",
		},
		{
			Type: fuse.DT_Link,
			Name: "team",
		},
	}, nil
}

func (r *root) Lookup(
	ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (
	n fs.Node, err error) {
	select {
	case <-r.shutdownCh:
		return nil, fuse.ENOENT
	default:
	}

	mountpoint, err := r.findKBFSMount(ctx)
	if err != nil {
		if req.Name == notRunningName {
			return symlink{"/dev/null"}, nil
		}
		return nil, err
	}

	resp.EntryValid = 0
	switch req.Name {
	case "private", "public", "team", ".kbfs_error", ".kbfs_metrics",
		".kbfs_profiles", ".kbfs_reset_caches", ".kbfs_status",
		"kbfs.error.txt", "kbfs.nologin.txt", ".kbfs_enable_auto_journals",
		".kbfs_disable_auto_journals", ".kbfs_enable_block_prefetching",
		".kbfs_disable_block_prefetching", ".kbfs_enable_debug_server",
		".kbfs_disable_debug_server", ".kbfs_edit_history":
		return symlink{filepath.Join(mountpoint, req.Name)}, nil
	}
	return nil, fuse.ENOENT
}

func unmount(currUID, mountAsUID uint64, dir string) {
	if currUID != mountAsUID {
		// Unmounting requires escalating the effective user to the
		// mounting user.  But we leave the real user ID the same.
		err := syscall.Setreuid(int(currUID), int(mountAsUID))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Can't setuid: %+v\n", err)
			os.Exit(1)
		}
	}

	err := fuse.Unmount(dir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Couldn't unmount cleanly: %+v\n", err)
	}

	// Set it back.
	if currUID != mountAsUID {
		err := syscall.Setreuid(int(currUID), int(currUID))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Can't setuid: %+v\n", err)
			os.Exit(1)
		}
	}
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s <mountpoint>\n", os.Args[0])
		os.Exit(1)
	}

	// Restrict the mountpoint to paths starting with "/keybase".
	// Since this is a suid binary, it is dangerous to allow arbitrary
	// mountpoints.  TODO: Read a redirector mountpoint from a
	// root-owned config file.
	r := newRoot()
	if os.Args[1] != fmt.Sprintf("/%s", r.runmodeStr) {
		fmt.Fprintf(os.Stderr, "ERROR: The redirector may only mount at "+
			"/%s; %s is an invalid mountpoint\n", r.runmodeStr, os.Args[1])
		os.Exit(1)
	}

	u, err := user.Lookup(mountAsUser)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: can't find %s user: %v\n",
			mountAsUser, err)
		os.Exit(1)
	}
	// Refuse to accept uids with high bits set for now. They could overflow
	// int on 32-bit platforms. However the underlying C type is unsigned, so
	// no permanent harm was done (expect perhaps for -1/0xFFFFFFFF).
	mountAsUID, err := strconv.ParseUint(u.Uid, 10, 31)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: can't convert %s's UID %s: %v",
			mountAsUser, u.Uid, err)
		os.Exit(1)
	}

	currUser, err := user.Current()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: can't get the current user: %v", err)
		os.Exit(1)
	}
	currUID, err := strconv.ParseUint(currUser.Uid, 10, 31)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: can't convert %s's UID %s: %v",
			currUser.Username, currUser.Uid, err)
		os.Exit(1)
	}

	options := []fuse.MountOption{fuse.AllowOther()}
	options = append(options, fuse.FSName("keybase-redirector"))
	options = append(options, fuse.ReadOnly())
	switch runtime.GOOS {
	case "darwin":
		options = append(options, fuse.OSXFUSELocations(kbfusePath))
		options = append(options, fuse.VolumeName("keybase"))
		options = append(options, fuse.NoBrowse())
		// Without NoLocalCaches(), OSX will cache symlinks for a long time.
		options = append(options, fuse.NoLocalCaches())
	case "linux":
		err := disableDumpable()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Unable to prctl: %v", err)
		}
	}

	// Clear the environment to harden ourselves against any
	// unforeseen environmnent variables exposing vulnerabilities
	// during the effective user escalation below.
	os.Clearenv()

	if currUser.Uid != u.Uid {
		runtime.LockOSThread()
		// Escalate privileges of the effective user to the mounting
		// user briefly, just for the `Mount` call.  Keep the real
		// user the same throughout.
		err := syscall.Setreuid(int(currUID), int(mountAsUID))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Can't setreuid: %+v\n", err)
			os.Exit(1)
		}
	}

	c, err := fuse.Mount(os.Args[1], options...)
	if err != nil {
		fmt.Printf("Mount error, exiting cleanly: %+v\n", err)
		os.Exit(0)
	}

	if currUser.Uid != u.Uid {
		runtime.LockOSThread()
		err := syscall.Setreuid(int(currUID), int(currUID))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Can't setreuid: %+v\n", err)
			os.Exit(1)
		}
	}

	interruptChan := make(chan os.Signal, 1)
	signal.Notify(interruptChan, os.Interrupt)
	signal.Notify(interruptChan, syscall.SIGTERM)
	go func() {
		select {
		case <-interruptChan:
		case <-r.shutdownCh:
			return
		}

		// This might be a different system thread than the main code, so
		// we might need to setuid again.
		runtime.LockOSThread()
		unmount(currUID, mountAsUID, os.Args[1])
	}()

	restartChan := make(chan os.Signal, 1)
	signal.Notify(restartChan, syscall.SIGUSR1)
	go func() {
		<-restartChan

		fmt.Printf("Relaunching after an upgrade\n")

		// Make this mount look empty, so if we race with the new
		// process, it will be able to mount over us.  (Note that we
		// can't unmount first, because that causes this process to
		// exit immediately, before launching the new process.)
		close(r.shutdownCh)

		ex, err := utils.BinPath()
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"Couldn't get the current executable: %v", err)
			os.Exit(1)
		}
		cmd := exec.Command(ex, os.Args[1])
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err = cmd.Start()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Can't start upgraded copy: %+v\n", err)
			os.Exit(1)
		}

		// This might be a different system thread than the main code, so
		// we might need to setuid again.
		runtime.LockOSThread()
		unmount(currUID, mountAsUID, os.Args[1])
		os.Exit(0)
	}()

	srv := fs.New(c, &fs.Config{
		WithContext: func(ctx context.Context, _ fuse.Request) context.Context {
			return context.Background()
		},
	})
	_ = srv.Serve(r)
}
