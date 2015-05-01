package main

import (
	"fmt"
	"os"

	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// Keep this around to simplify things
var G = libkb.G
var G_UI *UI

func parseArgs() (libkb.CommandLine, libcmdline.Command, error) {
	cl := cmdline()
	cmd, err := cl.Parse(os.Args)
	if err != nil {
		err = fmt.Errorf("Error parsing command line arguments: %s\n", err.Error())
		return nil, nil, err
	}
	return cl, cmd, nil
}

func main() {
	G_UI = &UI{}
	libcmdline.Main(parseArgs, G_UI, true)
}
