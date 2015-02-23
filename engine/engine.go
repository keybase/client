package engine

import (
	"fmt"

	"github.com/keybase/go/libkb"
)

type EnginePrereqs struct {
	Session bool
}

type Engine interface {
	Run(ctx *Context, args interface{}, reply interface{}) error
	GetPrereqs() EnginePrereqs
	libkb.UIConsumer
}

func runPrereqs(e Engine) (err error) {
	prq := e.GetPrereqs()

	if prq.Session {
		var ok bool
		ok, err = G.Session.LoadAndCheck()
		if !ok {
			err = libkb.LoginRequiredError{}
		}
		if err != nil {
			return err
		}
	}

	return

}

func RunEngine(e Engine, ctx *Context, args interface{}, reply interface{}) error {
	if err := check(e, ctx); err != nil {
		return err
	}
	if err := runPrereqs(e); err != nil {
		return err
	}
	return e.Run(ctx, args, reply)
}

func check(c libkb.UIConsumer, ctx *Context) error {
	if err := checkUI(c, ctx); err != nil {
		return CheckError{fmt.Sprintf("%s: %s", c.Name(), err.Error())}
	}

	for _, sub := range c.SubConsumers() {
		if err := check(sub, ctx); err != nil {
			return CheckError{fmt.Sprintf("%s: %s", sub.Name(), err)}
		}
	}

	return nil
}

func checkUI(c libkb.UIConsumer, ctx *Context) error {
	for _, ui := range c.RequiredUIs() {
		if !ctx.HasUI(ui) {
			return CheckError{fmt.Sprintf("requires ui %q", ui)}
		}
	}
	return nil
}
