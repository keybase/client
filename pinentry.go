package libkb

import (
	"fmt"
)

type Pinentry struct {
	path string
}

func NewPinentry() *Pinentry {
	return &Pinentry{path: ""}
}

func (pe *Pinentry) Init() error {
	prog := G.Env.GetPinentry()
	var err error
	if len(prog) > 0 {
		if err := canExec(prog); err == nil {
			pe.path = prog
		} else {
			err = fmt.Errorf("Can't execute given pinentry program '%s': %s",
				prog, err.Error())
		}
	} else if prog, err = FindPinentry(); err == nil {
		pe.path = prog
	}
	return err
}
