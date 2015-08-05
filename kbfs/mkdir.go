package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func maybePrintPath(path string, err error, verbose bool) {
	if err == nil && verbose {
		fmt.Fprintf(os.Stderr, "mkdir: created directory '%s'\n", path)
	}
}

func createDir(ctx context.Context, kbfsOps libkbfs.KBFSOps, parentNode libkbfs.Node, dirname, path string, verbose bool) (libkbfs.Node, error) {
	childNode, _, err := kbfsOps.CreateDir(ctx, parentNode, dirname)
	maybePrintPath(path, err, verbose)
	return childNode, err
}

func mkdirOne(ctx context.Context, config libkbfs.Config, dirPathStr string, createIntermediate, verbose bool) error {
	p, err := makeKbfsPath(dirPathStr)
	if err != nil {
		return err
	}

	kbfsOps := config.KBFSOps()

	if createIntermediate {
		if p.pathType != tlfPath || len(p.tlfComponents) == 0 {
			// Nothing to do.
			return nil
		}

		tlfRoot := kbfsPath{
			pathType: tlfPath,
			public:   p.public,
			tlfName:  p.tlfName,
		}
		tlfNode, err := tlfRoot.getDirNode(ctx, config)
		if err != nil {
			return err
		}

		currP := tlfRoot
		currNode := tlfNode
		for i := 0; i < len(p.tlfComponents); i++ {
			dirname := p.tlfComponents[i]
			currP, err = currP.join(dirname)
			if err != nil {
				return err
			}

			nextNode, err := createDir(ctx, kbfsOps, currNode, dirname, currP.String(), verbose)
			if err == (libkbfs.NameExistsError{Name: dirname}) {
				nextNode, _, err = kbfsOps.Lookup(ctx, currNode, dirname)
			}
			if err != nil {
				return err
			}
			currNode = nextNode
		}
	} else {
		if p.pathType != tlfPath {
			return libkbfs.NameExistsError{Name: p.String()}
		}

		parentDir, dirname, err := p.dirAndBasename()
		if err != nil {
			return err
		}

		if parentDir.pathType != tlfPath {
			// TODO: Ideally, this would error out if
			// p already existed.
			_, err := p.getDirNode(ctx, config)
			maybePrintPath(p.String(), err, verbose)
			return err
		}

		parentNode, err := parentDir.getDirNode(ctx, config)
		if err != nil {
			return err
		}

		_, err = createDir(ctx, kbfsOps, parentNode, dirname, p.String(), verbose)
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
