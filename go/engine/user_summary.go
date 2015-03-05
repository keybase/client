package engine

import (
	"strings"

	"github.com/keybase/client/go/libkb"
)

type UserSummary struct {
	uids      []libkb.UID
	summaries map[string]summary
}

func NewUserSummary(uids []libkb.UID) *UserSummary {
	return &UserSummary{uids: uids}
}

// Name is the unique engine name.
func (e *UserSummary) Name() string {
	return "UserSummary"
}

// GetPrereqs returns the engine prereqs (none).
func (e *UserSummary) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *UserSummary) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *UserSummary) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *UserSummary) Run(ctx *Context, args, reply interface{}) error {
	sums, err := e.get()
	if err != nil {
		return err
	}
	e.summaries = sums
	return nil
}

type webproof struct {
	Hostname  string
	Protocols []string
}

type pubkey struct {
	KeyFingerprint string `json:"key_fingerprint"`
	Bits           int    `json:"bits"`
	Algo           int    `json:"algo"`
}

type proofs struct {
	Twitter    string     `json:"twitter,omitempty"`
	Github     string     `json:"github,omitempty"`
	Reddit     string     `json:"reddit,omitempty"`
	Hackernews string     `json:"hackernews,omitempty"`
	Coinbase   string     `json:"coinbase,omitempty"`
	Web        []webproof `json:"web,omitempty"`
	PublicKey  pubkey     `json:"public_key,omitempty"`
}

type summary struct {
	Thumbnail string `json:"thumbnail"`
	Username  string `json:"username"`
	IDVersion int    `json:"id_version"`
	FullName  string `json:"full_name"`
	Bio       string `json:"bio"`
	Proofs    proofs `json:"remote_proofs,omitempty"`
}

func (e *UserSummary) get() (map[string]summary, error) {
	var j struct {
		Users map[string]summary `json:"display"`
	}
	j.Users = make(map[string]summary)
	args := libkb.ApiArg{
		Endpoint:    "user/display_info",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"uids": libkb.S{Val: e.uidlist()},
		},
	}
	// using POST because uids list might be long...
	if err := G.API.PostDecode(args, &j); err != nil {
		return nil, err
	}

	return j.Users, nil
}

func (e *UserSummary) uidlist() string {
	s := make([]string, len(e.uids))
	for i, u := range e.uids {
		s[i] = u.String()
	}
	return strings.Join(s, ",")
}

func (e *UserSummary) Summaries() map[string]summary {
	return e.summaries
}
