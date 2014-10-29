package main

import (
	"fmt"
	"github.com/keybase/go-libkb"
	"os"
)

// Keep this around to simplify things
var G = &libkb.G

func parseArgs() (libkb.CommandLine, Command, error) {
	p := NewCommandLine()
	cmd, err := p.Parse(os.Args)
	if err != nil {
		err = fmt.Errorf("Error parsing command line arguments: %s\n", err.Error())
		return nil, nil, err
	}
	return p, cmd, nil
}

func main() {
	G.Init()
	err := main2()
	e2 := G.Shutdown()
	if err == nil {
		err = e2
	}
	if err != nil {
		G.Log.Error(err.Error())
		os.Exit(2)
	}
}

func main2() error {

	cmdline, cmd, err := parseArgs()
	if cmd == nil || err != nil {
		return err
	}

	if err = G.ConfigureAll(cmdline, cmd); err != nil {
		return err
	}

	return cmd.Run()
}
