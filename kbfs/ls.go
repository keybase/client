package main

import (
	"flag"
	"fmt"
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func printHeader(p kbfsPath) {
	fmt.Printf("%s:\n", p)
}

func computeModeStr(entryType libkbfs.EntryType) string {
	var typeStr string
	switch entryType {
	case libkbfs.File:
		typeStr = "-"
	case libkbfs.Exec:
		typeStr = "-"
	case libkbfs.Dir:
		typeStr = "d"
	case libkbfs.Sym:
		typeStr = "l"
	default:
		typeStr = "?"
	}

	// TODO: Figure out whether the current user is just a reader,
	// and omit w below if so.
	var modeStr string
	switch entryType {
	case libkbfs.File:
		modeStr = "rw-"
	case libkbfs.Exec:
		modeStr = "rwx"
	case libkbfs.Dir:
		modeStr = "rwx"
	case libkbfs.Sym:
		modeStr = "rwx"
	default:
		modeStr = "rw-"
	}

	// TODO: Figure out whether this is a public directory.
	return fmt.Sprintf("%s%s%s%s", typeStr, modeStr, modeStr, "---")
}

func printEntry(ctx context.Context, config libkbfs.Config, dir kbfsPath, name string, entryType libkbfs.EntryType, longFormat, useSigil bool) {
	var sigil string
	if useSigil {
		switch entryType {
		case libkbfs.File:
		case libkbfs.Exec:
			sigil = "*"
		case libkbfs.Dir:
			sigil = "/"
		case libkbfs.Sym:
			sigil = "@"
		default:
			sigil = "?"
		}
	}
	if longFormat {
		p, err := dir.join(name)
		if err != nil {
			printError("ls", err)
		}
		_, de, err := p.getNode(ctx, config)
		if err != nil {
			printError("ls", err)
		}

		modeStr := computeModeStr(entryType)
		mtimeStr := time.Unix(0, de.Mtime).Format("Jan 02 15:04")
		var symPathStr string
		if entryType == libkbfs.Sym {
			symPathStr = fmt.Sprintf(" -> %s", de.SymPath)
		}
		fmt.Printf("%s\t%d\t%s\t%s%s%s\n", modeStr, de.Size, mtimeStr, name, sigil, symPathStr)
	} else {
		fmt.Printf("%s%s\n", name, sigil)
	}
}

func lsHelper(ctx context.Context, config libkbfs.Config, p kbfsPath, hasMultiple bool, handleEntry func(string, libkbfs.EntryType)) error {
	kbfsOps := config.KBFSOps()

	switch p.pathType {
	case rootPath:
		if hasMultiple {
			printHeader(p)
		}
		handleEntry(topName, libkbfs.Dir)
		return nil

	case keybasePath:
		if hasMultiple {
			printHeader(p)
		}
		handleEntry(publicName, libkbfs.Dir)
		handleEntry(privateName, libkbfs.Dir)
		return nil

	case keybaseChildPath:
		favs, err := kbfsOps.GetFavorites(ctx)
		if err != nil {
			return err
		}

		if hasMultiple {
			printHeader(p)
		}
		for _, fav := range favs {
			if p.public == fav.Public {
				handleEntry(fav.Name, libkbfs.Dir)
			}
		}
		return nil

	case tlfPath:
		n, de, err := p.getNode(ctx, config)
		if err != nil {
			return err
		}

		if de.Type == libkbfs.Dir {
			// GetDirChildren doesn't verify the dir-ness
			// of the node correctly (since it ends up
			// creating a new DirBlock if the node isn't
			// in the cache already).
			//
			// TODO: Fix the above.
			children, err := kbfsOps.GetDirChildren(ctx, n)
			if err != nil {
				return err
			}

			if hasMultiple {
				printHeader(p)
			}
			for name, entryType := range children {
				handleEntry(name, entryType)
			}
		} else {
			_, name, err := p.dirAndBasename()
			if err != nil {
				return err
			}
			handleEntry(name, de.Type)
		}
		return nil

	default:
		break
	}

	return fmt.Errorf("invalid KBFS path %s", p)
}

func lsOne(ctx context.Context, config libkbfs.Config, p kbfsPath, longFormat, useSigil, recursive, hasMultiple bool, errorFn func(error)) {
	var children []string
	handleEntry := func(name string, entryType libkbfs.EntryType) {
		if recursive && entryType == libkbfs.Dir {
			children = append(children, name)
		}
		printEntry(ctx, config, p, name, entryType, longFormat, useSigil)
	}
	err := lsHelper(ctx, config, p, hasMultiple || recursive, handleEntry)
	if err != nil {
		errorFn(err)
		// Fall-through.
	}

	if recursive {
		for _, name := range children {
			childPath, err := p.join(name)
			if err != nil {
				errorFn(err)
				continue
			}

			fmt.Print("\n")
			lsOne(ctx, config, childPath, longFormat, useSigil, true, true, errorFn)
		}
	}
}

func ls(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs ls", flag.ContinueOnError)
	longFormat := flags.Bool("l", false, "List in long format.")
	useSigil := flags.Bool("F", false, "Display sigils after each pathname.")
	recursive := flags.Bool("R", false, "Recursively list subdirectories encountered.")
	flags.Parse(args)

	nodePathStrs := flags.Args()
	if len(nodePathStrs) == 0 {
		printError("ls", errAtLeastOnePath)
		exitStatus = 1
		return
	}

	hasMultiple := len(nodePathStrs) > 1
	for i, nodePathStr := range nodePathStrs {
		p, err := makeKbfsPath(nodePathStr)
		if err != nil {
			printError("ls", err)
			exitStatus = 1
			continue
		}

		if i > 0 {
			fmt.Print("\n")
		}

		lsOne(ctx, config, p, *longFormat, *useSigil, *recursive, hasMultiple, func(err error) {
			printError("ls", err)
			exitStatus = 1
		})
	}
	return
}
