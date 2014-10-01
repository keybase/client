
package main

import (
	kb "github.com/keybase/libkbgo"
	"os"
)

// Keep this around to simplify things
var G = &kb.G

func parseArgs() {
	p := kb.PosixCommandLine{}
	docmd, err := p.Parse(os.Args)
	if err != nil {
		G.Log.Fatalf("Error parsing command line arguments: %s\n", err.Error())
	}
	if !docmd {
		os.Exit(0)
	}
	G.SetCommandLine(p)
}

func main() {
	kb.InitGlobals()
	parseArgs()
}
