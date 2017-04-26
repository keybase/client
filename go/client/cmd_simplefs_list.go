// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bytes"
	"errors"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// ListOptions is for the linux style
type ListOptions struct {
	all         bool
	long        bool
	human       bool
	one         bool
	dir         bool
	color       bool
	sortReverse bool
	sortTime    bool
	sortSize    bool
	help        bool
	dirsFirst   bool
}

// CmdSimpleFSList is the 'fs ls' command.
type CmdSimpleFSList struct {
	libkb.Contextified
	paths    []keybase1.Path
	recurse  bool
	winStyle bool
	options  ListOptions
}

// NewCmdSimpleFSList creates a new cli.Command.
func NewCmdSimpleFSList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "ls",
		ArgumentHelp: "<path>",
		Usage:        "list directory contents",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSList{Contextified: libkb.NewContextified(g)}, "ls", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "rec, recursive",
				Usage: "recurse into subdirectories",
			},
			cli.BoolFlag{
				Name:  "dirs-first",
				Usage: "list directories first",
			},
			cli.BoolFlag{
				Name:  "nocolor",
				Usage: "remove color formatting",
			},
			cli.BoolFlag{
				Name:  "1, one",
				Usage: "one entry per line",
			},
			cli.BoolFlag{
				Name:  "a, all",
				Usage: "include entries starting with '.'",
			},
			cli.BoolFlag{
				Name:  "l, long",
				Usage: "long listing",
			},
			cli.BoolFlag{
				Name:  "r, sort-reverse",
				Usage: "reverse any sorting",
			},
			cli.BoolFlag{
				Name:  "t, sort-time",
				Usage: "sort entries by modify time",
			},
			cli.BoolFlag{
				Name:  "s, sort-size",
				Usage: "sort entries by size",
			},
			cli.BoolFlag{
				Name:  "w, windows",
				Usage: "windows style dir",
			},
		},
	}

}

// HandleTopLevelKeybaseList - See if this is either /keybase/public or /keybase/private,
// and request favorites accordingly.
func (c *CmdSimpleFSList) HandleTopLevelKeybaseList(path keybase1.Path) (bool, error) {
	private := false
	pathType, err := path.PathType()
	if err != nil {
		return false, err
	}
	if pathType != keybase1.PathType_KBFS {
		return false, nil
	}
	acc := filepath.Clean(strings.ToLower(path.Kbfs()))
	acc = filepath.ToSlash(acc)
	c.G().Log.Debug("fs ls HandleTopLevelKeybaseList: %s -> %s", path.Kbfs(), acc)
	if acc == "/private" {
		private = true
	} else if acc != "/public" {
		return false, nil
	}

	arg := keybase1.GetFavoritesArg{}
	tlfs, err := list(arg)
	if err != nil {
		return true, err
	}

	result := keybase1.SimpleFSListResult{}

	// copy the list result into a SimpleFS result
	// to use the same output function
	for _, f := range tlfs.FavoriteFolders {
		if f.Private == private {
			result.Entries = append(result.Entries, keybase1.Dirent{
				Name:       f.Name,
				DirentType: keybase1.DirentType_DIR,
			})
		}

	}
	err = c.output(result)

	return true, err
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSList) Run() error {

	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	paths, err := doSimpleFSGlob(ctx, c.G(), cli, c.paths)
	if err != nil {
		return err
	}

	// If the argument was globbed, we really just want a stat of each item
	if len(paths) > 1 {
		var listResult keybase1.SimpleFSListResult
		for _, path := range paths {
			e, err := cli.SimpleFSStat(context.TODO(), path)
			if err != nil {
				return err
			}
			// TODO: should stat include the path in the result?
			e.Name = pathToString(path)
			listResult.Entries = append(listResult.Entries, e)
		}
		c.output(listResult)
	} else if len(paths) == 1 {
		path := paths[0]
		c.G().Log.Debug("SimpleFSList %s", pathToString(path))

		opid, err2 := cli.SimpleFSMakeOpid(ctx)
		if err2 != nil {
			return err2
		}
		defer cli.SimpleFSClose(ctx, opid)
		if c.recurse {
			err = cli.SimpleFSListRecursive(ctx, keybase1.SimpleFSListRecursiveArg{
				OpID: opid,
				Path: path,
			})
		} else {
			err = cli.SimpleFSList(ctx, keybase1.SimpleFSListArg{
				OpID: opid,
				Path: path,
			})
		}
		if err != nil {
			return err
		}

		err = cli.SimpleFSWait(ctx, opid)
		if err != nil {
			return err
		}
		gotList := false
		for {
			listResult, err := cli.SimpleFSReadList(ctx, opid)
			// Eat the error here because it may just mean the results
			// are complete. TODO: should KBFS return non-error here
			// until the opid is closed?
			if err != nil || len(listResult.Entries) == 0 {
				if gotList == true {
					err = nil
				}
				return err
			}
			gotList = true
			err = c.output(listResult)
			if err != nil {
				return err
			}
		}
	}
	return err
}

// like keybase1.FormatTime(), except no time zone
func formatListTime(t keybase1.Time) string {
	layout := "2006-01-02 15:04:05"
	return keybase1.FromTime(t).Format(layout)
}

func (c *CmdSimpleFSList) output(listResult keybase1.SimpleFSListResult) error {
	ui := c.G().UI.GetTerminalUI()

	if c.winStyle {
		for _, e := range listResult.Entries {
			if e.DirentType == keybase1.DirentType_DIR || e.DirentType == keybase1.DirentType_SYM {
				ui.Printf("%s\t<%s>\t\t%s\n", formatListTime(e.Time), keybase1.DirentTypeRevMap[e.DirentType], e.Name)
			} else {
				ui.Printf("%s\t%9d\t%s\n", formatListTime(e.Time), e.Size, e.Name)
			}
		}
	} else {
		// capture the current terminal dimensions
		terminalWidth, _ := ui.TerminalSize()

		var outputBuffer bytes.Buffer

		err := c.ls(&outputBuffer, listResult, terminalWidth)
		if err != nil {
			return err
		}

		if outputBuffer.String() != "" {
			ui.Printf("%s", outputBuffer.String())
		}
	}
	return nil
}

// ParseArgv gets the required path argument for this command.
func (c *CmdSimpleFSList) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	c.recurse = ctx.Bool("recurse")
	c.winStyle = ctx.Bool("windows")
	c.options.all = ctx.Bool("all")
	c.options.long = ctx.Bool("long")
	c.options.one = ctx.Bool("one")
	c.options.dir = true // treat dirs as regular entries
	c.options.color = !ctx.Bool("nocolor")
	c.options.sortReverse = ctx.Bool("sort-reverse")
	c.options.sortTime = ctx.Bool("sort-time")
	c.options.sortSize = ctx.Bool("sort-size")
	c.options.dirsFirst = ctx.Bool("dirs-first")

	if nargs < 1 {
		return errors.New("ls requires at least one KBFS path argument")
	}

	for _, src := range ctx.Args() {
		argPath := makeSimpleFSPath(c.G(), src)
		pathType, err := argPath.PathType()
		if err != nil {
			return err
		}
		if pathType != keybase1.PathType_KBFS {
			return errors.New("ls requires KBFS path arguments")
		}
		c.paths = append(c.paths, argPath)
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
