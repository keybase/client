package teams

import (
	"github.com/keybase/client/go/libkb"
)

type Upgrader struct{}

func NewUpgrader() *Upgrader {
	return &Upgrader{}
}

func (u *Upgrader) Run(m libkb.MetaContext) {
	go BackgroundPinTLFLoop(m)
}
