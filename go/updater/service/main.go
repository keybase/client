// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/kardianos/osext"
	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/keybase"
	"github.com/keybase/client/go/updater/util"
)

type flags struct {
	version       bool
	logToFile     bool
	appName       string
	pathToKeybase string
	command       string
}

func main() {
	f, args := loadFlags()
	if len(args) > 0 {
		f.command = args[0]
	}
	if err := run(f); err != nil {
		os.Exit(1)
	}
}

func loadFlags() (flags, []string) {
	f := flags{}
	flag.BoolVar(&f.version, "version", false, "Show version")
	flag.BoolVar(&f.logToFile, "log-to-file", false, "Log to file")
	flag.StringVar(&f.pathToKeybase, "path-to-keybase", "", "Path to keybase executable")
	flag.StringVar(&f.appName, "app-name", defaultAppName(), "App name")
	flag.Parse()
	args := flag.Args()
	return f, args
}

func defaultAppName() string {
	if runtime.GOOS == "linux" {
		return "keybase"
	}
	return "Keybase"
}

func run(f flags) error {
	if f.version {
		fmt.Printf("%s\n", updater.Version)
		return nil
	}
	ulog := logger{}

	if f.logToFile {
		logFile, _, err := ulog.setLogToFile(f.appName, "keybase.updater.log")
		if err != nil {
			ulog.Errorf("Error setting logging to file: %s", err)
		}
		defer util.Close(logFile)
	}

	// Set default path to keybase if not set
	if f.pathToKeybase == "" {
		path, err := osext.Executable()
		if err != nil {
			ulog.Warning("Error determining our executable path: %s", err)
		} else {
			dir, _ := filepath.Split(path)
			pathToKeybase := filepath.Join(dir, "keybase")
			ulog.Debugf("Using default path to keybase: %s", pathToKeybase)
			f.pathToKeybase = pathToKeybase
		}
	}

	if f.pathToKeybase == "" {
		ulog.Warning("Missing -path-to-keybase")
	}

	switch f.command {
	case "need-update":
		ctx, updater := keybase.NewUpdaterContext(f.appName, f.pathToKeybase, ulog, keybase.Check)
		needUpdate, err := updater.NeedUpdate(ctx)
		if err != nil {
			ulog.Error(err)
			return err
		}
		// Keybase service expects to parse this output as a boolean.
		// Do not change unless changing in both locations
		// https: //github.com/keybase/client/blob/master/go/client/cmd_update.go
		fmt.Println(needUpdate)
	case "check":
		if err := updateCheckFromFlags(f, ulog); err != nil {
			ulog.Error(err)
			return err
		}
	case "download-latest":
		ctx, updater := keybase.NewUpdaterContext(f.appName, f.pathToKeybase, ulog, keybase.CheckPassive)
		updateAvailable, _, err := updater.CheckAndDownload(ctx)
		if err != nil {
			ulog.Error(err)
			return err
		}
		// Keybase service expects to parse this output as a boolean.
		// Do not change unless changing in both locations
		// https: //github.com/keybase/client/blob/master/go/client/cmd_update.go
		fmt.Println(updateAvailable)
	case "apply-downloaded":
		ctx, updater := keybase.NewUpdaterContext(f.appName, f.pathToKeybase, ulog, keybase.Check)
		applied, err := updater.ApplyDownloaded(ctx)
		if err != nil {
			ulog.Error(err)
			return err
		}
		fmt.Println(applied)
	case "service", "":
		svc := serviceFromFlags(f, ulog)
		svc.Run()
	case "clean":
		if runtime.GOOS == "windows" {
			ctx, _ := keybase.NewUpdaterContext(f.appName, f.pathToKeybase, ulog, keybase.CheckPassive)
			fmt.Printf("Doing DeepClean\n")
			ctx.DeepClean()
		} else {
			ulog.Errorf("Unknown command: %s", f.command)
		}
	default:
		ulog.Errorf("Unknown command: %s", f.command)
	}
	return nil
}

func serviceFromFlags(f flags, ulog logger) *service {
	ulog.Infof("Updater %s", updater.Version)
	ctx, upd := keybase.NewUpdaterContext(f.appName, f.pathToKeybase, ulog, keybase.Service)
	return newService(upd, ctx, ulog, f.appName)
}

func updateCheckFromFlags(f flags, ulog logger) error {
	ctx, updater := keybase.NewUpdaterContext(f.appName, f.pathToKeybase, ulog, keybase.Check)
	_, err := updater.Update(ctx)
	return err
}
