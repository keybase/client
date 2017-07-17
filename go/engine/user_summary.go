// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type UserSummary struct {
	uids      []keybase1.UID
	summaries map[keybase1.UID]*Summary
	libkb.Contextified
}

func NewUserSummary(uids []keybase1.UID, g *libkb.GlobalContext) *UserSummary {
	return &UserSummary{
		uids:         uids,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *UserSummary) Name() string {
	return "UserSummary"
}

// GetPrereqs returns the engine prereqs (none).
func (e *UserSummary) Prereqs() Prereqs {
	return Prereqs{}
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
func (e *UserSummary) Run(ctx *Context) error {
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

func (w WebProof) Export() keybase1.WebProof {
	r := keybase1.WebProof{Hostname: w.Hostname}
	r.Protocols = make([]string, len(w.Protocols))
	copy(r.Protocols, w.Protocols)
	return r
}

type WebProofList []WebProof
type SocialProofList []SocialProof

func (w WebProofList) Export() []keybase1.WebProof {
	r := make([]keybase1.WebProof, len(w))
	for i, p := range w {
		r[i] = p.Export()
	}
	return r
}

func (s SocialProof) Export() keybase1.TrackProof {
	return keybase1.TrackProof{
		ProofType: s.Service,
		ProofName: s.Username,
		IdString:  (s.Username + "@" + s.Service),
	}
}

func (s SocialProofList) Export() []keybase1.TrackProof {
	r := make([]keybase1.TrackProof, len(s))
	for i, p := range s {
		r[i] = p.Export()
	}
	return r
}

type PGPKey struct {
	KeyFingerprint string `json:"key_fingerprint"`
	Bits           int    `json:"bits"`
	Algo           int    `json:"algo"`
}

func (p *PGPKey) Export() keybase1.PublicKey {
	return keybase1.PublicKey{
		PGPFingerprint: p.KeyFingerprint,
	}
}

type Proofs struct {
	Social  SocialProofList `json:"social,omitempty"`
	Web     WebProofList    `json:"web,omitempty"`
	PGPKeys []*PGPKey       `json:"pgp_keys,omitempty"`
}

func (p *Proofs) Export() keybase1.Proofs {
	if p == nil {
		return keybase1.Proofs{}
	}
	r := keybase1.Proofs{
		Web:    p.Web.Export(),
		Social: p.Social.Export(),
	}
	if len(p.PGPKeys) > 0 {
		r.PublicKeys = make([]keybase1.PublicKey, len(p.PGPKeys))
		for i, k := range p.PGPKeys {
			r.PublicKeys[i] = k.Export()
		}
	}
	return r
}

type Summary struct {
	UID       keybase1.UID `json:"-"`
	Username  string       `json:"username"`
	Thumbnail string       `json:"thumbnail"`
	IDVersion int          `json:"id_version"`
	FullName  string       `json:"full_name"`
	Bio       string       `json:"bio"`
	Proofs    *Proofs      `json:"remote_proofs,omitempty"`
}

func (s Summary) Export() keybase1.UserSummary {
	return keybase1.UserSummary{
		Uid:       s.UID,
		Username:  s.Username,
		Thumbnail: s.Thumbnail,
		IdVersion: s.IDVersion,
		FullName:  s.FullName,
		Bio:       s.Bio,
		Proofs:    s.Proofs.Export(),
	}
}

type displayInfo struct {
	Status libkb.AppStatus           `json:"status"`
	Users  map[keybase1.UID]*Summary `json:"display"`
}

func (d *displayInfo) GetAppStatus() *libkb.AppStatus {
	return &d.Status
}

func (e *UserSummary) get() (map[keybase1.UID]*Summary, error) {

	args := libkb.APIArg{
		Endpoint: "user/display_info",
		Args: libkb.HTTPArgs{
			"uids": libkb.S{Val: e.uidlist()},
		},
	}
	// using POST because uids list might be long...
	var j displayInfo
	if err := e.G().API.PostDecode(args, &j); err != nil {
		return nil, err
	}

	// XXX necessary?
	for k, v := range j.Users {
		v.UID = k
	}

	return j.Users, nil
}

func (e *UserSummary) uidlist() string {
	if len(e.uids) > libkb.UserSummaryLimit {
		e.uids = e.uids[0:libkb.UserSummaryLimit]
	}
	s := make([]string, len(e.uids))
	for i, u := range e.uids {
		s[i] = u.String()
	}
	return strings.Join(s, ",")
}

func (e *UserSummary) Summaries() map[keybase1.UID]*Summary {
	return e.summaries
}

func (e *UserSummary) SummariesList() []*Summary {
	// using append in case e.summaries isn't complete
	var res []*Summary

	// but will still keep them ordered correctly
	for _, u := range e.uids {
		s, ok := e.summaries[u]
		if ok {
			res = append(res, s)
		}
	}
	return res
}

func (e *UserSummary) ExportedSummariesList() (ret []keybase1.UserSummary) {
	lst := e.SummariesList()
	for _, el := range lst {
		ret = append(ret, el.Export())
	}
	return ret
}
