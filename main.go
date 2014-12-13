
package libcmdline

import (
	"github.com/keybase/go-libkb"
	"os"
	"os/signal"
)

// Keep this around to simplify things
var G = &libkb.G

type parseArgHook func() (libkb.CommandLine, Command, error)

func Main(parseArgs parseArgHook) {
	G.Init()
	go HandleSignals()
	err := main2(parseArgs)
	e2 := G.Shutdown()
	if err == nil {
		err = e2
	}
	if err != nil {
		G.Log.Error(err.Error())
		os.Exit(2)
	}
}

func main2(parseArgs parseArgHook) error {

	cmdline, cmd, err := parseArgs()
	if cmd == nil || err != nil {
		return err
	}

	if err = G.ConfigureAll(cmdline, cmd); err != nil {
		return err
	}

	return cmd.Run()
}


func HandleSignals() {
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
