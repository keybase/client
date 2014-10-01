
package libkb

import (
	"fmt"
	"runtime"
)

type CmdVersion struct {}

func (v CmdVersion) Run() error {
	fmt.Printf("Keybase Command-Line App v%s\n", CLIENT_VERSION)
	fmt.Printf("- Built with %s\n", runtime.Version())
	fmt.Printf("- Visit https://keybase.io for more details\n")
	return nil
}

func (v CmdVersion) UseConfig() bool { return false }
