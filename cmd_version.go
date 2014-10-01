
package libkb

import (
	"fmt"
	"runtime"
)

type VersionCommand struct {}


func (v VersionCommand) Run() error {
	fmt.Printf("Keybase Command-Line App v%s\n", CLIENT_VERSION)
	fmt.Printf("- Built with %s\n", runtime.Version())
	fmt.Printf("- Visit https://keybase.io for more details\n")
	return nil
}

func (v VersionCommand) UseConfig() bool { return false }
