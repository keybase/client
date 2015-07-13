package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func createDir(ctx context.Context, kbfsOps libkbfs.KBFSOps, parentNode libkbfs.Node, dirname, path string, verbose bool) (libkbfs.Node, error) {
	childNode, _, err := kbfsOps.CreateDir(ctx, parentNode, dirname)
	if err == nil {
		fmt.Fprintf(os.Stderr, "mkdir: created directory '%s'\n", path)
	}
	return childNode, err
}

func mkdirOne(ctx context.Context, config libkbfs.Config, dirPath string, createIntermediate, verbose bool) error {
	components, err := split(dirPath)
	if err != nil {
		return err
	}

	kbfsOps := config.KBFSOps()

	if createIntermediate {
		tlfComponents := components[:2]
		tlfNode, err := openDir(ctx, config, tlfComponents)
		if err != nil {
			return err
		}

		currNode := tlfNode
		for i := 2; i < len(components); i++ {
			dirname := components[i]
			path := join(components[:i+1])
			nextNode, err := createDir(ctx, kbfsOps, currNode, dirname, path, verbose)
			if err == (libkbfs.NameExistsError{Name: dirname}) {
				nextNode, _, err = kbfsOps.Lookup(ctx, currNode, dirname)
			}
			if err != nil {
				return err
			}
			currNode = nextNode
		}
	} else {
		parentComponents := components[:len(components)-1]
		parentNode, err := openDir(ctx, config, parentComponents)
		if err != nil {
			return err
		}

		dirname := components[len(components)-1]
		_, err = createDir(ctx, kbfsOps, parentNode, dirname, dirPath, verbose)
		if err != nil {
			return err
		}
	}

	return nil
}

func mkdir(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs mkdir", flag.ContinueOnError)
	createIntermediate := flags.Bool("p", false, "Create intermediate directories as required.")
	verbose := flags.Bool("v", false, "Print extra status output.")
	flags.Parse(args)

	nodePaths := flags.Args()
	if len(nodePaths) == 0 {
		printError("mkdir", errAtLeastOnePath)
		exitStatus = 1
		return
	}

	for _, nodePath := range nodePaths {
		err := mkdirOne(ctx, config, nodePath, *createIntermediate, *verbose)
		if err != nil {
			printError("mkdir", err)
			exitStatus = 1
		}
	}
	return
}
