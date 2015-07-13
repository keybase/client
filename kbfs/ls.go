package main

import (
	"flag"
	"fmt"
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func printHeader(components []string) {
	fmt.Printf("%s:\n", join(components))
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

func printEntry(ctx context.Context, config libkbfs.Config, components []string, name string, entryType libkbfs.EntryType, longFormat, useSigil bool) {
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
		_, de, err := openNode(ctx, config, append(components, name))
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

func lsHelper(ctx context.Context, config libkbfs.Config, components []string, hasMultiple bool, handleEntry func(string, libkbfs.EntryType)) error {
	kbfsOps := config.KBFSOps()

	if len(components) == 1 {
		tlfIDs, err := kbfsOps.GetFavorites(ctx)
		if err != nil {
			return err
		}

		if hasMultiple {
			printHeader(components)
		}
		for _, tlfID := range tlfIDs {
			rmds, err := config.MDServer().GetForTLF(ctx, tlfID)
			if err != nil {
				return err
			}
			th := rmds.MD.GetTlfHandle()
			handleEntry(th.ToString(config), libkbfs.Dir)
		}

		return err
	}

	node, de, err := openNode(ctx, config, components)
	if err != nil {
		return err
	}

	if de.Type == libkbfs.Dir {
		// GetDirChildren doesn't verify the dir-ness of the node
		// correctly (since it ends up creating a new DirBlock if the
		// node isn't in the cache already).
		//
		// TODO: Fix the above.
		children, err := kbfsOps.GetDirChildren(ctx, node)
		if err != nil {
			return err
		}

		if hasMultiple {
			printHeader(components)
		}
		for name, entryType := range children {
			handleEntry(name, entryType)
		}
	} else {
		name := components[len(components)-1]
		handleEntry(name, de.Type)
	}

	return nil
}

func lsOne(ctx context.Context, config libkbfs.Config, nodePath string, longFormat, useSigil, recursive, hasMultiple bool) error {
	components, err := split(nodePath)
	if err != nil {
		return err
	}

	if len(components) == 0 || components[0] != "keybase" {
		return fmt.Errorf("%s is not in /keybase", nodePath)
	}

	var children []string
	handleEntry := func(name string, entryType libkbfs.EntryType) {
		if recursive && entryType == libkbfs.Dir {
			children = append(children, name)
		}
		printEntry(ctx, config, components, name, entryType, longFormat, useSigil)
	}
	err = lsHelper(ctx, config, components, hasMultiple || recursive, handleEntry)
	if err != nil {
		return err
	}

	if recursive {
		for _, name := range children {
			fmt.Print("\n")
			lsOne(ctx, config, join(append(components, name)), longFormat, useSigil, true, true)
		}
	}

	return nil
}

func ls(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs ls", flag.ContinueOnError)
	longFormat := flags.Bool("l", false, "List in long format.")
	useSigil := flags.Bool("F", false, "Display sigils after each pathname.")
	recursive := flags.Bool("R", false, "Recursively list subdirectories encountered.")
	flags.Parse(args)

	nodePaths := flags.Args()
	if len(nodePaths) == 0 {
		printError("ls", errAtLeastOnePath)
		exitStatus = 1
		return
	}

	hasMultiple := len(nodePaths) > 1
	for i, nodePath := range nodePaths {
		if i > 0 {
			fmt.Print("\n")
		}

		err := lsOne(ctx, config, nodePath, *longFormat, *useSigil, *recursive, hasMultiple)
		if err != nil {
			printError("ls", err)
			exitStatus = 1
		}
	}
	return
}
