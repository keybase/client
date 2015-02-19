package engine

import (
	"github.com/keybase/go/libkb"
)

type Context struct {
	uig *libkb.UIGroup
}

func NewContext(uis ...interface{}) *Context {
	c := &Context{uig: libkb.NewUIGroup()}
	if err := c.AddUIs(uis...); err != nil {
		panic(err)
	}
	return c
}

func (c *Context) HasUI(kind libkb.UIKind) bool {
	return c.uig.Exists(kind)
}

func (c *Context) AddUIs(uis ...interface{}) error {
	for _, ui := range uis {
		if err := c.uig.Add(ui); err != nil {
			return err
		}
	}
	return nil
}

func (c *Context) UIG() libkb.UIGroup {
	return *c.uig
}
