package engine

import (
	"fmt"

	"github.com/keybase/go/libkb"
)

type UIConsumer interface {
	RequiredUIs() []libkb.UIKind
}

type Engine interface {
	Name() string
	Run(ctx *Context, args interface{}, reply interface{}) error
	SubConsumers() []UIConsumer // XXX not sure if this is best way yet...
	UIConsumer
}

func RunEngine(e Engine, ctx *Context, args interface{}, reply interface{}) error {
	if err := check(e, ctx); err != nil {
		return err
	}
	return e.Run(ctx, args, reply)
}

func check(e Engine, ctx *Context) error {
	if err := checkUI(e, ctx); err != nil {
		return fmt.Errorf("%s engine: %s", e.Name(), err)
	}

	for _, sub := range e.SubConsumers() {
		if err := checkUI(sub, ctx); err != nil {
			return fmt.Errorf("%s engine: %s", e.Name(), err)
		}
	}

	return nil
}

func checkUI(c UIConsumer, ctx *Context) error {
	for _, ui := range c.RequiredUIs() {
		if !ctx.HasUI(ui) {
			return fmt.Errorf("requires ui %s", ui)
		}
	}
	return nil
}
