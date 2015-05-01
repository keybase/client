//
package engine

import (
	"encoding/json"
	"regexp"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

// SigsList is an engine for the sigs-list command.
type SigsList struct {
	SigsListArgs

	user *libkb.User
	sigs []libkb.TypedChainLink
}

type SigsListArgs struct {
	Username string
	AllKeys  bool
	Types    map[string]bool
	Filterx  string
	Verbose  bool
	Revoked  bool
}

// NewTemplate creates a Template engine.
func NewSigsList(args SigsListArgs) *SigsList {
	return &SigsList{
		SigsListArgs: args,
	}
}

// Name is the unique engine name.
func (e *SigsList) Name() string {
	return "SigsList"
}

// GetPrereqs returns the engine prereqs.
func (e *SigsList) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
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
	arg := libkb.LoadUserArg{AllKeys: e.AllKeys}
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

	e.sigs = e.user.IdTable().Order
	return e.processSigs()
}

// Sigs returns the sig list, after processing.
func (e *SigsList) Sigs() []keybase_1.Sig {
	res := make([]keybase_1.Sig, len(e.sigs))
	for i, s := range e.sigs {
		var key string
		fp := s.GetPgpFingerprint()
		if fp != nil {
			key = fp.ToDisplayString(e.Verbose)
		}
		res[i] = keybase_1.Sig{
			Seqno:        int(s.GetSeqno()),
			SigIdDisplay: s.GetSigId().ToDisplayString(e.Verbose),
			Type:         s.Type(),
			Ctime:        int(s.GetCTime().Unix()),
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
	Seqno   int64  `json:"seqno"`
	SigID   string `json:"sig_id"`
	Type    string `json:"type"`
	CTime   int64  `json:"ctime"`
	Revoked bool   `json:"revoked"`
	Active  bool   `json:"active"`
	Key     string `json:"key_fingerprint,omitempty"`
	Body    string `json:"statement"`
}

func (e *SigsList) JSON() (string, error) {
	exp := make([]sigexp, len(e.sigs))
	for i, s := range e.sigs {
		var key string
		fp := s.GetPgpFingerprint()
		if fp != nil {
			key = fp.ToDisplayString(e.Verbose)
		}
		exp[i] = sigexp{
			Seqno:   int64(s.GetSeqno()),
			SigID:   s.GetSigId().ToDisplayString(e.Verbose),
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
	return ((!e.Revoked && (link.IsRevoked() || link.IsRevocationIsh())) ||
		(!e.AllKeys && !e.isActiveKey(link)))
}
