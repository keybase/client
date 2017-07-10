// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//
package engine

import (
	"encoding/json"
	"regexp"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// SigsList is an engine for the sigs-list command.
type SigsList struct {
	SigsListArgs

	user *libkb.User
	sigs []libkb.TypedChainLink
	libkb.Contextified
}

type SigsListArgs struct {
	Username string
	Types    map[string]bool
	Filterx  string
	Verbose  bool
	Revoked  bool
}

// NewSigsList creates a SigsList engine.
func NewSigsList(args SigsListArgs, g *libkb.GlobalContext) *SigsList {
	return &SigsList{
		SigsListArgs: args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *SigsList) Name() string {
	return "SigsList"
}

// GetPrereqs returns the engine prereqs.
func (e *SigsList) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SigsList) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SigsList) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *SigsList) Run(ctx *Context) error {
	arg := libkb.LoadUserArg{Contextified: libkb.NewContextified(e.G())}
	arg.SetGlobalContext(e.G())
	if len(e.Username) > 0 {
		arg.Name = e.Username
	} else {
		arg.Self = true
	}

	var err error
	e.user, err = libkb.LoadUser(arg)
	if err != nil {
		return err
	}

	e.sigs = e.user.IDTable().Order
	return e.processSigs()
}

// Sigs returns the sig list, after processing.
func (e *SigsList) Sigs() []keybase1.Sig {
	res := make([]keybase1.Sig, len(e.sigs))
	for i, s := range e.sigs {
		var key string
		fp := s.GetPGPFingerprint()
		if fp != nil {
			key = fp.ToDisplayString(e.Verbose)
		}
		res[i] = keybase1.Sig{
			Seqno:        s.GetSeqno(),
			SigIDDisplay: s.GetSigID().ToDisplayString(e.Verbose),
			Type:         s.Type(),
			CTime:        keybase1.ToTime(s.GetCTime()),
			Revoked:      s.IsRevoked(),
			Active:       e.isActiveKey(s),
			Key:          key,
			Body:         s.ToDisplayString(),
		}
	}
	return res
}

// ugh
type sigexp struct {
	Seqno   keybase1.Seqno `json:"seqno"`
	SigID   string         `json:"sig_id"`
	Type    string         `json:"type"`
	CTime   int64          `json:"ctime"`
	Revoked bool           `json:"revoked"`
	Active  bool           `json:"active"`
	Key     string         `json:"key_fingerprint,omitempty"`
	Body    string         `json:"statement"`
}

func (e *SigsList) JSON() (string, error) {
	exp := make([]sigexp, len(e.sigs))
	for i, s := range e.sigs {
		var key string
		fp := s.GetPGPFingerprint()
		if fp != nil {
			key = fp.ToDisplayString(true /* verbose */)
		}
		exp[i] = sigexp{
			Seqno:   s.GetSeqno(),
			SigID:   s.GetSigID().ToDisplayString(true /* verbose */),
			Type:    s.Type(),
			CTime:   s.GetCTime().Unix(),
			Revoked: s.IsRevoked(),
			Active:  e.isActiveKey(s),
			Key:     key,
			Body:    s.ToDisplayString(),
		}
	}
	j, err := json.MarshalIndent(exp, "", "\t")
	if err != nil {
		return "", err
	}
	return string(j), nil

}

func (e *SigsList) processSigs() error {
	if err := e.skipSigs(); err != nil {
		return err
	}
	if err := e.selectSigs(); err != nil {
		return err
	}
	if err := e.filterRxx(); err != nil {
		return err
	}
	return nil
}

func (e *SigsList) skipSigs() error {
	e.filterSigs(func(l libkb.TypedChainLink) bool {
		return !e.skipLink(l)
	})
	return nil
}

func (e *SigsList) selectSigs() error {
	if e.Types != nil {
		e.filterSigs(func(l libkb.TypedChainLink) bool {
			ok, found := e.Types[l.Type()]
			return ok && found
		})
	}
	return nil
}

func (e *SigsList) filterRxx() error {
	if len(e.Filterx) == 0 {
		return nil
	}
	rxx, err := regexp.Compile(e.Filterx)
	if err != nil {
		return err
	}
	e.filterSigs(func(l libkb.TypedChainLink) bool {
		return rxx.MatchString(l.ToDisplayString())
	})
	return nil
}

func (e *SigsList) filterSigs(f func(libkb.TypedChainLink) bool) {
	var sigs []libkb.TypedChainLink
	for _, link := range e.sigs {
		if f(link) {
			sigs = append(sigs, link)
		}
	}
	e.sigs = sigs
}

func (e *SigsList) isActiveKey(link libkb.TypedChainLink) bool {
	return link.IsInCurrentFamily(e.user)
}

func (e *SigsList) skipLink(link libkb.TypedChainLink) bool {
	return (!e.Revoked && (link.IsRevoked() || link.IsRevocationIsh()))
}
