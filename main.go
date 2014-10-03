
package main

import (
	"github.com/keybase/go-libkb"
	"os"
)

// Keep this around to simplify things
var G = &libkb.G

func parseArgs() libkb.Command {
	p := libkb.PosixCommandLine{}
	cmd, err := p.Parse(os.Args)
	if err != nil {
		G.Log.Fatalf("Error parsing command line arguments: %s\n", err.Error())
	}
	G.SetCommandLine(p)
	if cmd == nil {
		G.Log.Fatalf("Cannot continue; no command to run")
	}
	return cmd
}

func testLogging() {
	G.Log.Debug("hello debug")
	G.Log.Info("hello info")
	G.Log.Notice("hello notice")
	G.Log.Warning("hello warning")
	G.Log.Error("hello error")
}


func main() {
	G.Init()
	cmd := parseArgs()
	G.ConfigureLogging()
	if cmd.UseConfig() { G.ConfigureConfig() }
	if cmd.UseKeyring() { G.ConfigureKeyring() }

	testLogging()
	if err := cmd.Run(); err != nil { G.Log.Fatal(err.Error()) }
}
