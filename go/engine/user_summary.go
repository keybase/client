package engine

import (
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type UserSummary struct {
	uids      []libkb.UID
	summaries map[string]*Summary
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

type WebProof struct {
	Hostname  string   `json:"hostname"`
	Protocols []string `json:"protocols"`
}

type SocialProof struct {
	Service  string `json:"service"`
	Username string `json:"username"`
}

func (w WebProof) Export() keybase_1.WebProof {
	r := keybase_1.WebProof{Hostname: w.Hostname}
	copy(r.Protocols, w.Protocols)
	return r
}

type WebProofList []WebProof
type SocialProofList []SocialProof

func (w WebProofList) Export() []keybase_1.WebProof {
	r := make([]keybase_1.WebProof, len(w))
	for i, p := range w {
		r[i] = p.Export()
	}
	return r
}

func (s SocialProof) Export() keybase_1.TrackProof {
	return keybase_1.TrackProof{
		ProofType: s.Service,
		ProofName: s.Username,
		IdString:  (s.Username + "@" + s.Service),
	}
}

func (s SocialProofList) Export() []keybase_1.TrackProof {
	r := make([]keybase_1.TrackProof, len(s))
	for i, p := range s {
		r[i] = p.Export()
	}
	return r
}

type PubKey struct {
	KeyFingerprint string `json:"key_fingerprint"`
	Bits           int    `json:"bits"`
	Algo           int    `json:"algo"`
}

func (p *PubKey) Export() keybase_1.PubKey {
	return keybase_1.PubKey{
		KeyFingerprint: p.KeyFingerprint,
		Bits:           p.Bits,
		Algo:           p.Algo,
	}
}

type Proofs struct {
	Social    SocialProofList `json:"social,omitempty"`
	Web       WebProofList    `json:"web,omitempty"`
	PublicKey *PubKey         `json:"public_key,omitempty"`
}

func (p *Proofs) Export() keybase_1.Proofs {
	if p == nil {
		return keybase_1.Proofs{}
	}
	r := keybase_1.Proofs{
		Web:    p.Web.Export(),
		Social: p.Social.Export(),
	}
	if p.PublicKey != nil {
		r.PublicKeys = []keybase_1.PubKey{p.PublicKey.Export()}
	}
	return r
}

type Summary struct {
	UID       libkb.UID `json:"-"`
	Thumbnail string    `json:"thumbnail"`
	Username  string    `json:"username"`
	IDVersion int       `json:"id_version"`
	FullName  string    `json:"full_name"`
	Bio       string    `json:"bio"`
	Proofs    *Proofs   `json:"remote_proofs,omitempty"`
}

func (s Summary) Export() keybase_1.UserSummary {
	return keybase_1.UserSummary{
		Uid:       s.UID.Export(),
		Thumbnail: s.Thumbnail,
		Username:  s.Username,
		IdVersion: s.IDVersion,
		FullName:  s.FullName,
		Bio:       s.Bio,
		Proofs:    s.Proofs.Export(),
	}
}

func (e *UserSummary) get() (map[string]*Summary, error) {
	var j struct {
		Users map[string]*Summary `json:"display"`
	}
	args := libkb.ApiArg{
		Endpoint: "user/display_info",
		Args: libkb.HttpArgs{
			"uids": libkb.S{Val: e.uidlist()},
		},
	}
	// using POST because uids list might be long...
	if err := G.API.PostDecode(args, &j); err != nil {
		return nil, err
	}

	for k, v := range j.Users {
		u, err := libkb.UidFromHex(k)
		if err == nil {
			v.UID = *u
		}
	}

	return j.Users, nil
}

func (e *UserSummary) uidlist() string {
	if len(e.uids) > libkb.USER_SUMMARY_LIMIT {
		e.uids = e.uids[0:libkb.USER_SUMMARY_LIMIT]
	}
	s := make([]string, len(e.uids))
	for i, u := range e.uids {
		s[i] = u.String()
	}
	return strings.Join(s, ",")
}

func (e *UserSummary) Summaries() map[string]*Summary {
	return e.summaries
}

func (e *UserSummary) SummariesList() []*Summary {
	// using append in case e.summaries isn't complete
	var res []*Summary

	// but will still keep them ordered correctly
	for _, u := range e.uids {
		s, ok := e.summaries[u.String()]
		if ok {
			res = append(res, s)
		}
	}
	return res
}

func (e *UserSummary) ExportedSummariesList() (ret []keybase_1.UserSummary) {
	lst := e.SummariesList()
	for _, el := range lst {
		ret = append(ret, el.Export())
	}
	return ret
}
