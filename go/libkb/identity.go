// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/keybase/go-crypto/openpgp/packet"
)

type Identity struct {
	Username string
	Comment  string
	Email    string
}

var idRE = regexp.MustCompile("" +
	`^"?([^(<]*?)"?` + // The beginning name of the user (no comment or key)
	`(?:\s*\((.*?)\)"?)?` + // The optional comment
	`(?:\s*<(.*?)>)?$`) // The optional email address

func ParseIdentity(s string) (*Identity, error) {
	v := idRE.FindStringSubmatch(s)
	if v == nil {
		return nil, fmt.Errorf("Bad PGP-style identity: %s", s)
	}
	ret := &Identity{
		Username: v[1],
		Comment:  v[2],
		Email:    v[3],
	}
	return ret, nil
}

func (i Identity) Format() string {
	var parts []string
	if len(i.Username) > 0 {
		parts = append(parts, i.Username)
	}
	if len(i.Comment) > 0 {
		parts = append(parts, "("+i.Comment+")")
	}
	if len(i.Email) > 0 {
		parts = append(parts, "<"+i.Email+">")
	}
	return strings.Join(parts, " ")
}

func (i Identity) String() string {
	return i.Format()
}

func (i Identity) ToPGPUserID() *packet.UserId {
	return packet.NewUserId(i.Username, i.Comment, i.Email)

}

func KeybaseIdentity(un NormalizedUsername) Identity {
	if un.IsNil() {
		un = G.Env.GetUsername()
	}
	return Identity{
		Username: CanonicalHost + "/" + un.String(),
		Email:    un.String() + "@" + CanonicalHost,
	}
}

type Identities []Identity
