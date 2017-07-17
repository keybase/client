// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type SearchEngine struct {
	libkb.Contextified
	query     string
	numWanted int
	results   []keybase1.SearchResult
}

type SearchEngineArgs struct {
	Query     string
	NumWanted int
}

func NewSearchEngine(args SearchEngineArgs, g *libkb.GlobalContext) *SearchEngine {
	return &SearchEngine{
		query:        args.Query,
		numWanted:    args.NumWanted,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *SearchEngine) Name() string {
	return "Search"
}

func (e *SearchEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *SearchEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
	}
}

func (e *SearchEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *SearchEngine) Run(ctx *Context) error {
	APIArgs := libkb.HTTPArgs{
		"q": libkb.S{Val: e.query},
	}
	if e.numWanted > 0 {
		APIArgs["num_wanted"] = libkb.I{Val: e.numWanted}
	}
	res, err := e.G().API.Get(libkb.APIArg{
		Endpoint: "user/autocomplete",
		Args:     APIArgs,
	})
	if err != nil {
		return err
	}
	length, err := res.Body.AtKey("completions").Len()
	if err != nil {
		return fmt.Errorf("Failed to get completions from server.")
	}
	allCompletions := res.Body.AtKey("completions")
	for i := 0; i < length; i++ {
		componentKeys, err := allCompletions.AtIndex(i).AtKey("components").Keys()
		if err != nil {
			return fmt.Errorf("Failed to get completion components from server.")
		}
		completion := allCompletions.AtIndex(i)
		components := completion.AtKey("components")
		searchComponents := []keybase1.SearchComponent{}

		add := func(key string, val string, score float64) {
			searchComponents = append(searchComponents, keybase1.SearchComponent{
				Key:   key,
				Value: val,
				Score: score,
			})
		}

		for _, key := range componentKeys {
			if key == "websites" {
				n, err := components.AtKey(key).Len()
				if err != nil {
					return err
				}
				for i := 0; i < n; i++ {
					obj := components.AtKey(key).AtIndex(i)
					val, err := obj.AtKey("val").GetString()
					if err != nil {
						return err
					}
					score, err := obj.AtKey("score").GetFloat()
					if err != nil {
						return err
					}
					protocol, err := obj.AtKey("protocol").GetString()
					if err != nil {
						return err
					}
					if protocol == "" {
						return err
					}
					add(key, libkb.MakeURI(protocol, val), score)
				}

			} else {
				val, err := components.AtKey(key).AtKey("val").GetString()
				if err != nil {
					return err
				}
				score, err := components.AtKey(key).AtKey("score").GetFloat()
				if err != nil {
					return err
				}
				add(key, val, score)
			}
		}
		username, err := components.AtKey("username").AtKey("val").GetString()
		if err != nil {
			return err
		}
		uidString, err := completion.AtKey("uid").GetString()
		if err != nil {
			return err
		}
		uid, err := libkb.UIDFromHex(uidString)
		if err != nil {
			return err
		}
		totalScore, err := completion.AtKey("total_score").GetFloat()
		if err != nil {
			return err
		}
		e.results = append(e.results, keybase1.SearchResult{
			Uid:        uid,
			Username:   username,
			Components: searchComponents,
			Score:      totalScore,
		})
	}
	return nil
}

func (e *SearchEngine) GetResults() []keybase1.SearchResult {
	return e.results
}
