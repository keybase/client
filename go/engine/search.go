package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type SearchEngine struct {
	libkb.Contextified
	query     string
	numWanted int
	results   []keybase1.UserSummary
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

func (e *SearchEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
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
	APIArgs := libkb.HttpArgs{
		"q": libkb.S{Val: e.query},
	}
	if e.numWanted > 0 {
		APIArgs["num_wanted"] = libkb.I{Val: e.numWanted}
	}
	res, err := e.G().API.Get(libkb.ApiArg{
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
		socialProofs := []keybase1.TrackProof{}
		for _, proofTypeName := range componentKeys {
			if _, isService := libkb.REMOTE_SERVICE_TYPES[proofTypeName]; isService {
				val, err := components.AtKey(proofTypeName).AtKey("val").GetString()
				if err != nil {
					return err
				}
				socialProofs = append(socialProofs, keybase1.TrackProof{
					ProofType: proofTypeName,
					ProofName: val,
				})
			}
		}
		webProofs := []keybase1.WebProof{}
		webProofsLen, _ := components.AtKey("websites").Len()
		for i := 0; i < webProofsLen; i++ {
			site, err := components.AtKey("websites").AtIndex(i).AtKey("val").GetString()
			if err != nil {
				return err
			}
			protocol, err := components.AtKey("websites").AtIndex(i).AtKey("protocol").GetString()
			if err != nil {
				return err
			}
			webProofs = append(webProofs, keybase1.WebProof{
				Hostname:  site,
				Protocols: []string{protocol},
			})
		}
		username, err := components.AtKey("username").AtKey("val").GetString()
		if err != nil {
			return err
		}
		uidString, err := completion.AtKey("uid").GetString()
		if err != nil {
			return err
		}
		uid, err := libkb.UidFromHex(uidString)
		if err != nil {
			return err
		}
		// Sometimes thumbnail is null. In that case empty string is fine.
		thumbnail, _ := completion.AtKey("thumbnail").GetString()
		e.results = append(e.results, keybase1.UserSummary{
			Uid:       uid.Export(),
			Username:  username,
			Thumbnail: thumbnail,
			Proofs: keybase1.Proofs{
				Social: socialProofs,
				Web:    webProofs,
			},
		})
	}
	return nil
}

func (e *SearchEngine) GetResults() []keybase1.UserSummary {
	return e.results
}
