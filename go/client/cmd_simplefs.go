// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"errors"
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
		Subcommands: []cli.Command{
			NewCmdSimpleFSList(cl, g),
			NewCmdSimpleFSCopy(cl, g),
			NewCmdSimpleFSMove(cl, g),
			NewCmdSimpleFSRead(cl, g),
			NewCmdSimpleFSRemove(cl, g),
			NewCmdSimpleFSMkdir(cl, g),
			NewCmdSimpleFSStat(cl, g),
			NewCmdSimpleFSGetStatus(cl, g),
			NewCmdSimpleFSKill(cl, g),
			NewCmdSimpleFSPs(cl, g),
			NewCmdSimpleFSWrite(cl, g),
		},
	}
}

const mountDir = "/keybase"

func makeSimpleFSPath(g *libkb.GlobalContext, path string) keybase1.Path {

	path = filepath.ToSlash(path)
	if strings.HasSuffix(path, "/") {
		path = path[:len(path)-1]
	}

	// Test for the special mount dir prefix before the absolute test.
	// Otherwise the current dir will be prepended, below.
	if strings.HasPrefix(path, mountDir) {
		return keybase1.NewPathWithKbfs(path[len(mountDir):])
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
		return keybase1.NewPathWithKbfs(path[len(mountDir):])
	}

	return keybase1.NewPathWithLocal(path)
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

func pathToString(path keybase1.Path) string {
	pathType, err := path.PathType()
	if err != nil {
		return ""
	}
	if pathType == keybase1.PathType_KBFS {
		return path.Kbfs()
	}
	return path.Local()
}

// Cheeck whether the given path is a directory and return its string
func checkPathIsDir(ctx context.Context, cli keybase1.SimpleFSInterface, path keybase1.Path) (bool, string, error) {
	var isDir bool
	var pathString string
	var err error

	pathType, _ := path.PathType()
	if pathType == keybase1.PathType_KBFS {
		pathString = path.Kbfs()
		// See if the dest is a path or file
		destEnt, err := cli.SimpleFSStat(ctx, path)
		if err != nil {
			return false, "", err
		}

		if destEnt.DirentType == keybase1.DirentType_DIR {
			isDir = true
		}
	} else {
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
		return keybase1.NewPathWithKbfs(newDestString)
	}
	return keybase1.NewPathWithLocal(newDestString)
}

func checkElementExists(ctx context.Context, cli keybase1.SimpleFSInterface, dest keybase1.Path) error {
	destType, _ := dest.PathType()
	var err error

	// Check for overwriting
	if destType == keybase1.PathType_KBFS {
		// See if the dest file exists
		_, err2 := cli.SimpleFSStat(ctx, dest)
		if err2 == nil {
			err = ErrTargetFileExists
		}
	} else {
		if exists, _ := libkb.FileExists(dest.Local()); exists == true {
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

	g.Log.Debug("makeDestPath: srcPathString: %s isSrcDir: %v", pathToString(src), isSrcDir)

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
			g.Log.Debug("makeDestPath: new path with file: %s", pathToString(dest))
		}
	}

	err = checkElementExists(ctx, cli, dest)

	return dest, err
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
		argPath := makeSimpleFSPath(g, src)
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
		return srcPaths, destPath, errors.New(name + " reaquires KBFS source and/or destination")
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

func doSimpleFSRemoteGlob(ctx context.Context, g *libkb.GlobalContext, cli keybase1.SimpleFSInterface, path keybase1.Path) ([]keybase1.Path, error) {

	var returnPaths []keybase1.Path
	directory := filepath.ToSlash(filepath.Dir(path.Kbfs()))
	base := filepath.Base(path.Kbfs())

	// We know the filename has wildcards at this point.
	// kbfs list only works on directories, so build a glob from a list result.

	g.Log.Debug("doSimpleFSRemoteGlob %s", path.Kbfs())

	if strings.ContainsAny(directory, "?*[]") == true {
		return nil, errors.New("wildcards not supported in parent directories")
	}

	opid, err := cli.SimpleFSMakeOpid(ctx)
	if err != nil {
		return nil, err
	}
	defer cli.SimpleFSClose(ctx, opid)

	err = cli.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: keybase1.NewPathWithKbfs(directory),
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
			if err == nil && match == true {
				returnPaths = append(returnPaths, keybase1.NewPathWithKbfs(filepath.ToSlash(filepath.Join(directory, entry.Name))))
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

		pathString := pathToString(path)
		if strings.ContainsAny(filepath.Base(pathString), "?*[]") == false {
			returnPaths = append(returnPaths, path)
			continue
		}

		if pathType == keybase1.PathType_KBFS {
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
