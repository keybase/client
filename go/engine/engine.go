package engine

import (
	"fmt"
	"net/url"

	"github.com/keybase/client/go/libkb"
)

type Prereqs struct {
	Session bool
}

type Engine interface {
	Run(ctx *Context) error
	Prereqs() Prereqs
	libkb.UIConsumer
	G() *libkb.GlobalContext
}

func runPrereqs(e Engine, ctx *Context) (err error) {
	prq := e.Prereqs()

	if prq.Session {
		var ok bool
		ok, err = IsLoggedIn(e, ctx)
		if !ok {
			urlError, isURLError := err.(*url.Error)
			context := ""
			if isURLError {
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
	if err := runPrereqs(e, ctx); err != nil {
		return err
	}
	return e.Run(ctx)
}

func check(c libkb.UIConsumer, ctx *Context) error {
	if err := checkUI(c, ctx); err != nil {
		return CheckError{fmt.Sprintf("%s: %s", c.Name(), err)}
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
