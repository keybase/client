package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go-libkb"
	"os"
	"os/signal"
)

// Keep this around to simplify things
var G = &libkb.G

type Daemon struct {

}

func (d *Daemon) Run() error {
	return fmt.Errorf("run function unimplemented")
}

func (v *Daemon) ParseArgv(ctx *cli.Context) error {
	//G.Log.Info("nothing doing in parse")
	return nil
}

func (d *Daemon) GetUsage() libkb.Usage {
	return libkb.Usage {
		Config : true,
		KbKeyring : true,
		GpgKeyring : true,
		API : true,
		Socket : true,	
	}
}

func parseArgs() (libkb.CommandLine, libcmdline.Command, error) {

	cl := libcmdline.NewCommandLine(false)
	cl.SetDefaultCommand("daemon", &Daemon{})

	cmd, err := cl.Parse(os.Args)
	if err != nil {
		err = fmt.Errorf("Error parsing command line arguments: %s\n", err.Error())
		return nil, nil, err
	}
	return cl, cmd, nil
}

func handleSignals() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	for {
		s := <-c
		if s != nil {
			G.Shutdown()
			G.Log.Error("interrupted")
			os.Exit(3)
		}
	}

}

func main() {
	G.Init()
	go handleSignals()
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
