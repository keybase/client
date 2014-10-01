
package main

import (
	"github.com/keybase/libkbgo"
	"os"
	"fmt"
)

func main() {
	p := libkbgo.PosixCmdLine{}
	docmd, err := p.Parse(os.Args)
	fmt.Printf("error back: %v\n", err)
	var s string
	var d bool
	if docmd && err == nil {
		s = p.GetHome()
		d,_ = p.GetDebug()
	}
	fmt.Printf("Res: %s %v\n", s, d);
}


