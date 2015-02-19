package engine

import (
	"github.com/keybase/go/libkb"
)

type Context struct {
	uig *libkb.UIGroup
}

func NewContext() *Context {
	return &Context{uig: libkb.NewUIGroup()}
}

func (c *Context) HasUI(name libkb.UIName) bool {
	return c.uig.Exists(name)
}

func (c *Context) AddUI(ui interface{}) error {
	return c.uig.Add(ui)
}
