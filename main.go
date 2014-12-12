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
var G_UI *UI

func parseArgs() (libkb.CommandLine, libcmdline.Command, error) {

	cl := libcmdline.NewCommandLine()
	cmds := []cli.Command{
		NewCmdConfig(cl),
		NewCmdDb(cl),
		NewCmdId(cl),
		NewCmdListTracking(cl),
		NewCmdLogin(cl),
		NewCmdLogout(cl),
		NewCmdMykey(cl),
		NewCmdPing(cl),
		NewCmdProve(cl),
		NewCmdResolve(cl),
		NewCmdSigs(cl),
		NewCmdSign(cl),
		NewCmdSignup(cl),
		NewCmdTrack(cl),
		NewCmdVersion(cl),
	}
	cl.AddCommands(cmds)

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

	// Set a global UI for us to access.
	// And also one for libkb
	G_UI = &UI{}
	G.SetUI(G_UI)

	if err = G.ConfigureAll(cmdline, cmd); err != nil {
		return err
	}

	return cmd.Run()
}
