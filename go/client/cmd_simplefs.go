// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

var TargetFileExistsError = errors.New("target file exists")

type SimpleFSStatter interface {
	SimpleFSStat(ctx context.Context, path keybase1.Path) (res keybase1.Dirent, err error)
}

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

func makeSimpleFSPath(g *libkb.GlobalContext, path string) keybase1.Path {
	mountDir := "/keybase"

	if strings.HasPrefix(path, mountDir) {
		return keybase1.NewPathWithKbfs(path[len(mountDir):])
	}

	// make absolute
	if !filepath.IsAbs(path) {
		if wd, err := os.Getwd(); err == nil {
			path = filepath.Join(wd, path)
		}
	}

	// eval symlinks
	if pathSym, err := filepath.EvalSymlinks(path); err == nil {
		path = pathSym
	}

	path = filepath.ToSlash(filepath.Clean(path))

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
func checkPathIsDir(ctx context.Context, cli SimpleFSStatter, path keybase1.Path) (bool, string, error) {
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

func checkElementExists(ctx context.Context, cli SimpleFSStatter, dest keybase1.Path) error {
	destType, _ := dest.PathType()
	var err error

	// Check for overwriting
	if destType == keybase1.PathType_KBFS {
		// See if the dest file exists
		_, err2 := cli.SimpleFSStat(ctx, dest)
		if err2 == nil {
			err = TargetFileExistsError
		}
	} else {
		if exists, _ := libkb.FileExists(dest.Local()); exists == true {
			// we should have already tested whether it's a directory
			err = TargetFileExistsError
		}
	}
	return err
}

// Make sure the destination ends with the same filename as the source,
// if any, unless the destination is not a directory
func makeDestPath(
	g *libkb.GlobalContext,
	ctx context.Context,
	cli SimpleFSStatter,
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
			if err2 == TargetFileExistsError {
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
