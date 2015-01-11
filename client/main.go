package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go/libkb"
	"os"
)

// Keep this around to simplify things
var G = &libkb.G
var G_UI *UI

func parseArgs() (libkb.CommandLine, libcmdline.Command, error) {

	cl := libcmdline.NewCommandLine(true)
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

func main() {
	G_UI = &UI{}
	libcmdline.Main(parseArgs, G_UI, true)
}
