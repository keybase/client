// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

var ErrTargetFileExists = errors.New("target file exists")

// NewCmdSimpleFS creates the device command, which is just a holder
// for subcommands.
func NewCmdSimpleFS(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "fs",
		Usage:        "Perform filesystem operations",
		ArgumentHelp: "[arguments...]",
		Subcommands: append([]cli.Command{
			NewCmdSimpleFSList(cl, g),
			NewCmdSimpleFSCopy(cl, g),
			NewCmdSimpleFSMove(cl, g),
			NewCmdSimpleFSSymlink(cl, g),
			NewCmdSimpleFSRead(cl, g),
			NewCmdSimpleFSRemove(cl, g),
			NewCmdSimpleFSMkdir(cl, g),
			NewCmdSimpleFSStat(cl, g),
			NewCmdSimpleFSGetStatus(cl, g),
			NewCmdSimpleFSKill(cl, g),
			NewCmdSimpleFSPs(cl, g),
			NewCmdSimpleFSWrite(cl, g),
			NewCmdSimpleFSDebug(cl, g),
			NewCmdSimpleFSSetDebugLevel(cl, g),
			NewCmdSimpleFSHistory(cl, g),
			NewCmdSimpleFSQuota(cl, g),
			NewCmdSimpleFSRecover(cl, g),
			NewCmdSimpleFSReset(cl, g),
			NewCmdSimpleFSClearConflicts(cl, g),
			NewCmdSimpleFSFinishResolvingConflicts(cl, g),
			NewCmdSimpleFSSync(cl, g),
			NewCmdSimpleFSUploads(cl, g),
			NewCmdSimpleFSIndex(cl, g),
			NewCmdSimpleFSSearch(cl, g),
		}, getBuildSpecificFSCommands(cl, g)...),
	}
}

const (
	mountDir   = "/keybase"
	protPrefix = "keybase://"
)

func makeKbfsPath(
	path string, rev int64, timeString, relTimeString string) (
	keybase1.Path, error) {
	p := strings.TrimPrefix(path, mountDir)
	if strings.HasPrefix(p, protPrefix) {
		var err error
		p, err = url.PathUnescape(p)
		if err != nil {
			return keybase1.Path{}, err
		}
		p = strings.TrimPrefix(p, protPrefix)
	}
	if rev == 0 && timeString == "" && relTimeString == "" {
		return keybase1.NewPathWithKbfsPath(p), nil
	} else if rev != 0 {
		if timeString != "" || relTimeString != "" {
			return keybase1.Path{}, errors.New(
				"can't set both a revision and a time")
		}

		return keybase1.NewPathWithKbfsArchived(keybase1.KBFSArchivedPath{
			Path: p,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithRevision(
				keybase1.KBFSRevision(rev)),
		}), nil
	} else if timeString != "" {
		if relTimeString != "" {
			return keybase1.Path{}, errors.New(
				"can't set both an absolute time and a relative time")
		}

		return keybase1.NewPathWithKbfsArchived(keybase1.KBFSArchivedPath{
			Path: p,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithTimeString(
				timeString),
		}), nil
	}
	return keybase1.NewPathWithKbfsArchived(keybase1.KBFSArchivedPath{
		Path: p,
		ArchivedParam: keybase1.NewKBFSArchivedParamWithRelTimeString(
			relTimeString),
	}), nil

}

func makeSimpleFSPathWithArchiveParams(
	path string, rev int64, timeString, relTimeString string) (
	keybase1.Path, error) {
	path = filepath.ToSlash(path)
	if strings.HasSuffix(path, "/") {
		path = path[:len(path)-1]
	}

	// Test for the special mount dir prefix before the absolute test.
	// Otherwise the current dir will be prepended, below.
	if strings.HasPrefix(path, mountDir) ||
		strings.HasPrefix(path, protPrefix) {
		return makeKbfsPath(path, rev, timeString, relTimeString)
	}

	// make absolute
	if absPath, err := filepath.Abs(path); err == nil {
		path = absPath
	}

	// eval symlinks
	if pathSym, err := filepath.EvalSymlinks(path); err == nil {
		path = pathSym
	}

	path = filepath.ToSlash(filepath.Clean(path))

	// Certain users seem to want to use SimpleFS on their
	// mounted KBFS. This is for those who want to do so
	// from "/keybase/..."
	if strings.HasPrefix(path, mountDir) {
		return makeKbfsPath(path, rev, timeString, relTimeString)
	}

	if rev > 0 {
		return keybase1.Path{}, fmt.Errorf(
			"can't specify a revision for a local path")
	} else if timeString != "" {
		return keybase1.Path{}, fmt.Errorf(
			"can't specify a time string for a local path")
	} else if relTimeString != "" {
		return keybase1.Path{}, fmt.Errorf(
			"can't specify a relative time string for a local path")
	}

	return keybase1.NewPathWithLocal(path), nil
}

func makeSimpleFSPath(path string) (keybase1.Path, error) {
	return makeSimpleFSPathWithArchiveParams(path, 0, "", "")
}

func stringToOpID(arg string) (keybase1.OpID, error) {
	var opid keybase1.OpID
	bytes, err := hex.DecodeString(arg)
	if err != nil {
		return keybase1.OpID{}, err
	}
	if copy(opid[:], bytes) != len(opid) {
		return keybase1.OpID{}, errors.New("bad or missing opid")
	}
	return opid, nil
}

// Check whether the given path is a directory and return its string
func checkPathIsDir(ctx context.Context, cli keybase1.SimpleFSInterface, path keybase1.Path) (bool, string, error) {
	var isDir bool
	var pathString string
	var err error

	pathType, _ := path.PathType()
	switch pathType {
	case keybase1.PathType_KBFS, keybase1.PathType_KBFS_ARCHIVED:
		if pathType == keybase1.PathType_KBFS {
			pathString = path.Kbfs().Path
		} else {
			pathString = path.KbfsArchived().Path
		}
		// See if the dest is a path or file
		destEnt, err := cli.SimpleFSStat(ctx, keybase1.SimpleFSStatArg{Path: path})
		if err != nil {
			return false, "", err
		}

		if destEnt.DirentType == keybase1.DirentType_DIR {
			isDir = true
		}
	case keybase1.PathType_LOCAL:
		pathString = path.Local()
		// An error is OK, could be a target filename
		// that does not exist yet
		fileInfo, err := os.Stat(pathString)
		if err == nil {
			if fileInfo.IsDir() {
				isDir = true
			}
		}
	}
	return isDir, pathString, err
}

func joinSimpleFSPaths(destType keybase1.PathType, destPathString, srcPathString string) keybase1.Path {
	newDestString := filepath.ToSlash(filepath.Join(destPathString, filepath.Base(srcPathString)))
	if destType == keybase1.PathType_KBFS {
		return keybase1.NewPathWithKbfsPath(newDestString)
	}
	return keybase1.NewPathWithLocal(newDestString)
}

func checkElementExists(ctx context.Context, cli keybase1.SimpleFSInterface, dest keybase1.Path) error {
	destType, _ := dest.PathType()
	var err error

	// Check for overwriting
	if destType == keybase1.PathType_KBFS {
		// See if the dest file exists
		_, err2 := cli.SimpleFSStat(ctx, keybase1.SimpleFSStatArg{Path: dest})
		if err2 == nil {
			err = ErrTargetFileExists
		}
	} else {
		if exists, _ := libkb.FileExists(dest.Local()); exists {
			// we should have already tested whether it's a directory
			err = ErrTargetFileExists
		}
	}
	return err
}

// Make sure the destination ends with the same filename as the source,
// if any, unless the destination is not a directory
func makeDestPath(
	ctx context.Context,
	g *libkb.GlobalContext,
	cli keybase1.SimpleFSInterface,
	src keybase1.Path,
	dest keybase1.Path,
	isDestPath bool,
	destPathString string) (keybase1.Path, error) {

	isSrcDir, srcPathString, err := checkPathIsDir(ctx, cli, src)
	if err != nil {
		return keybase1.Path{}, err
	}

	g.Log.Debug("makeDestPath: srcPathString: %s isSrcDir: %v", src, isSrcDir)

	if isDestPath {
		// Source file and dest dir is an append case
		appendDest := !isSrcDir
		if isSrcDir {
			// Here, we have both source and dest as paths, so
			// we have to check whether dest exists. If so, append.
			err2 := checkElementExists(ctx, cli, dest)
			if err2 == ErrTargetFileExists {
				appendDest = true
			}
			g.Log.Debug("makeDestPath: src and dest both dir. append: %v", appendDest)
		}
		if appendDest {
			destType, _ := dest.PathType()
			// In this case, we must append the destination filename
			dest = joinSimpleFSPaths(destType, destPathString, srcPathString)
			g.Log.Debug("makeDestPath: new path with file: %s", dest)
		}
	}

	err = checkElementExists(ctx, cli, dest)

	return dest, err
}

func getRelTime(ctx *cli.Context) string {
	relTimeString := ctx.String("reltime")
	if relTimeString == "" {
		relTimeString = ctx.String("relative-time")
	}
	return relTimeString
}

// Make a list of source paths and one destination path from the given command line args
func parseSrcDestArgs(g *libkb.GlobalContext, ctx *cli.Context, name string) ([]keybase1.Path, keybase1.Path, error) {
	nargs := len(ctx.Args())

	var srcType, destType keybase1.PathType
	var srcPaths []keybase1.Path
	var destPath keybase1.Path

	if nargs < 2 {
		return srcPaths, destPath, errors.New(name + " requires one or more source arguments and a destination argument")
	}
	for i, src := range ctx.Args() {
		rev := int64(0)
		timeString := ""
		relTimeString := ""
		if i != nargs-1 {
			// All source paths use the same revision.
			rev = int64(ctx.Int("rev"))
			timeString = ctx.String("time")
			relTimeString = getRelTime(ctx)
		}
		argPath, err := makeSimpleFSPathWithArchiveParams(
			src, rev, timeString, relTimeString)
		if err != nil {
			return nil, keybase1.Path{}, err
		}
		tempPathType, err := argPath.PathType()
		if err != nil {
			return srcPaths, destPath, err
		}
		// Make sure all source paths are the same type
		if i == 0 {
			srcType = tempPathType
		} else if i == nargs-1 {
			destPath = argPath
			destType = tempPathType
			break
		} else if tempPathType != srcType {
			return srcPaths, destPath, errors.New(name + " requires all sources to be the same type")
		}
		srcPaths = append(srcPaths, argPath)
	}

	if srcType == keybase1.PathType_LOCAL && destType == keybase1.PathType_LOCAL {
		return srcPaths, destPath, errors.New(name + " requires KBFS source and/or destination")
	}
	return srcPaths, destPath, nil
}

func doOverwritePrompt(g *libkb.GlobalContext, dest string) error {
	prompt := dest + " exists. Do you want to overwrite?"
	if owrite, err := g.UI.GetTerminalUI().PromptYesNo(PromptDescriptorFSOverwrite, prompt, libkb.PromptDefaultNo); err != nil {
		return err
	} else if !owrite {
		return NotConfirmedError{}
	}
	return nil
}

func newPathWithSameType(
	pathString string, oldPath keybase1.Path) (keybase1.Path, error) {
	pt, err := oldPath.PathType()
	if err != nil {
		return keybase1.Path{}, err
	}

	switch pt {
	case keybase1.PathType_LOCAL:
		return keybase1.NewPathWithLocal(pathString), nil
	case keybase1.PathType_KBFS:
		return keybase1.NewPathWithKbfsPath(pathString), nil
	case keybase1.PathType_KBFS_ARCHIVED:
		return keybase1.NewPathWithKbfsArchived(keybase1.KBFSArchivedPath{
			Path:          pathString,
			ArchivedParam: oldPath.KbfsArchived().ArchivedParam,
		}), nil
	default:
		return keybase1.Path{}, fmt.Errorf("unknown path type: %s", pt)
	}
}

func doSimpleFSRemoteGlob(ctx context.Context, g *libkb.GlobalContext, cli keybase1.SimpleFSInterface, path keybase1.Path) ([]keybase1.Path, error) {

	var returnPaths []keybase1.Path
	pathString := path.String()
	directory := filepath.ToSlash(filepath.Dir(pathString))
	base := filepath.Base(pathString)

	// We know the filename has wildcards at this point.
	// kbfs list only works on directories, so build a glob from a list result.

	g.Log.Debug("doSimpleFSRemoteGlob %s", pathString)

	if strings.ContainsAny(directory, "?*[]") {
		return nil, errors.New("wildcards not supported in parent directories")
	}

	opid, err := cli.SimpleFSMakeOpid(ctx)
	if err != nil {
		return nil, err
	}
	defer cli.SimpleFSClose(ctx, opid)

	dirPath, err := newPathWithSameType(directory, path)
	if err != nil {
		return nil, err
	}
	err = cli.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: dirPath,
	})
	if err != nil {
		return nil, err
	}

	err = cli.SimpleFSWait(ctx, opid)
	if err != nil {
		return nil, err
	}

	for {
		listResult, err2 := cli.SimpleFSReadList(ctx, opid)
		if err2 != nil {
			// If we have some results, eat this error
			if len(returnPaths) == 0 {
				err = err2
			}
			break
		}
		for _, entry := range listResult.Entries {
			match, err := filepath.Match(base, entry.Name)
			if err == nil && match {
				rp, err := newPathWithSameType(
					filepath.ToSlash(filepath.Join(directory, entry.Name)),
					path)
				if err != nil {
					return nil, err
				}
				returnPaths = append(returnPaths, rp)
			}
		}
	}
	return returnPaths, err
}

func doSimpleFSGlob(ctx context.Context, g *libkb.GlobalContext, cli keybase1.SimpleFSInterface, paths []keybase1.Path) ([]keybase1.Path, error) {
	var returnPaths []keybase1.Path
	for _, path := range paths {
		pathType, err := path.PathType()
		if err != nil {
			return returnPaths, err
		}

		pathString := path.String()
		if !strings.ContainsAny(filepath.Base(pathString), "?*[]") {
			returnPaths = append(returnPaths, path)
			continue
		}

		if pathType == keybase1.PathType_KBFS ||
			pathType == keybase1.PathType_KBFS_ARCHIVED {
			// remote glob
			globbed, err := doSimpleFSRemoteGlob(ctx, g, cli, path)
			if err != nil {
				return nil, err
			}
			returnPaths = append(returnPaths, globbed...)
		} else {
			// local glob
			matches, err := filepath.Glob(pathString)
			if err != nil {
				return nil, err
			}
			for _, match := range matches {
				returnPaths = append(returnPaths, keybase1.NewPathWithLocal(match))
			}
		}
	}
	return returnPaths, nil
}

type OpCanceler struct {
	libkb.Contextified
	lock      *sync.Mutex
	cancelled bool
	opids     []keybase1.OpID
}

func NewOpCanceler(g *libkb.GlobalContext) *OpCanceler {
	return &OpCanceler{
		Contextified: libkb.NewContextified(g),
		lock:         &sync.Mutex{},
	}
}

func (j *OpCanceler) AddOp(opid keybase1.OpID) {
	j.lock.Lock()
	defer j.lock.Unlock()
	if j.cancelled {
		j.G().Log.Warning("added a SimpleFS opid after cancellation")
	}
	j.opids = append(j.opids, opid)
}

func (j *OpCanceler) IsCancelled() bool {
	j.lock.Lock()
	defer j.lock.Unlock()
	return j.cancelled
}

func (j *OpCanceler) Cancel() error {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.cancelled = true
	cli, err := GetSimpleFSClient(j.G())
	if err != nil {
		return err
	}
	var cancelError error
	for _, opid := range j.opids {
		opidString := hex.EncodeToString(opid[:])
		err := cli.SimpleFSCancel(context.TODO(), opid)
		if err != nil {
			// We retain the first cancel error we see, but we still try to
			// cancel all running operations.
			if cancelError == nil {
				cancelError = err
			}
			j.G().Log.Error("Error cancelling FS operation %s: %s", opidString, err)
		} else {
			j.G().Log.Info("Cancelled FS operation %s", opidString)
		}
	}
	return cancelError
}
