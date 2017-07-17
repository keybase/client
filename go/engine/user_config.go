// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
)

type UserConfigEngineArg struct {
	Key   string
	Value string
}

type UserConfigEngine struct {
	libkb.Contextified
	arg *UserConfigEngineArg
}

func NewUserConfigEngine(arg *UserConfigEngineArg, g *libkb.GlobalContext) *UserConfigEngine {
	return &UserConfigEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *UserConfigEngine) Name() string {
	return "UserConfig"
}

func (e *UserConfigEngine) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

func (e *UserConfigEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *UserConfigEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *UserConfigEngine) Run(ctx *Context) (err error) {
	keys := strings.SplitN(e.arg.Key, ".", 2)
	if len(keys) < 2 {
		return fmt.Errorf("Invalid key")
	}

	// Supports picture.source = "twitter" or "github".
	// This maps to http endpoint image/set_preference.json?identify_src=100 (or 101).
	// TODO We should clean this up.
	if keys[0] == "picture" {
		var key string
		var value string
		if keys[1] == "source" {
			key = "identity_src"

			switch e.arg.Value {
			case "twitter":
				value = "100"
			case "github":
				value = "101"
			default:
				return fmt.Errorf("Invalid picture.source")
			}
		}

		var err error
		_, err = e.G().API.Post(libkb.APIArg{
			Endpoint:    "image/set_preference",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				key: libkb.S{Val: value},
			},
		})
		if err != nil {
			return err
		}
	} else {
		return fmt.Errorf("Invalid key")
	}
	return nil
}
