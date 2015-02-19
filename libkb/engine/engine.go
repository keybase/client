package engine

import (
	"fmt"

	"github.com/keybase/go/libkb"
)

type Engine interface {
	Run(ctx *Context, args interface{}, reply interface{}) error
	RequiredUIs() []libkb.UIKind
	SubEngines() []Engine // XXX not sure if this is best way yet...
	Name() string
}

func RunEngine(e Engine, ctx *Context, args interface{}, reply interface{}) error {
	if err := check(e, ctx); err != nil {
		return err
	}
	return e.Run(ctx, args, reply)
}

func check(e Engine, ctx *Context) error {
	for _, ui := range e.RequiredUIs() {
		if !ctx.HasUI(ui) {
			return fmt.Errorf("engine %s requires ui %s", e.Name(), ui)
		}
	}

	for _, sub := range e.SubEngines() {
		if err := check(sub, ctx); err != nil {
			return err
		}
	}

	return nil
}
