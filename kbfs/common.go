package main

import (
	"fmt"
	"os"

	"github.com/keybase/kbfs/libkbfs"
)

const (
	topName     = "keybase"
	publicName  = "public"
	privateName = "private"
)

const publicSuffix = libkbfs.ReaderSep + libkbfs.PublicUIDName

func byteCountStr(n int) string {
	if n == 1 {
		return "1 byte"
	}
	return fmt.Sprintf("%d bytes", n)
}

func printError(prefix string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %s\n", prefix, err)
}
