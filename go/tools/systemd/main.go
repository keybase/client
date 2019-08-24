// +build linux,!android

package main

import "fmt"
import "github.com/keybase/client/go/systemd"

func main() {
	fmt.Println("IsUserSystemdRunning() ->", systemd.IsUserSystemdRunning())
	fmt.Println("IsRunningSystemd() ->", systemd.IsRunningSystemd())
}
