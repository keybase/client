package engine

import (
	"fmt"
	"net/url"

	"github.com/keybase/client/go/libkb"
)

type EnginePrereqs struct {
	Session bool
}

type Engine interface {
	Run(ctx *Context) error
	GetPrereqs() EnginePrereqs
	libkb.UIConsumer
}

func runPrereqs(e Engine) (err error) {
	prq := e.GetPrereqs()

	if prq.Session {
		var ok bool
		ok, err = G.Session.LoadAndCheck()
		if !ok {
			urlError, isUrlError := err.(*url.Error)
			context := ""
			if isUrlError {
				context = fmt.Sprintf("Encountered a network error: %s", urlError.Err)
			}
			err = libkb.LoginRequiredError{Context: context}
		}
		if err != nil {
			return err
		}
	}

	return

}

func RunEngine(e Engine, ctx *Context) error {
	if err := check(e, ctx); err != nil {
		return err
	}
	if err := runPrereqs(e); err != nil {
		return err
	}
	return e.Run(ctx)
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
