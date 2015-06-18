package libkb

import (
	"fmt"
	"regexp"
	"strings"

	"golang.org/x/crypto/openpgp/packet"
)

type Identity struct {
	Username string
	Comment  string
	Email    string
}

func ParseIdentity(s string) (*Identity, error) {
	rxx := regexp.MustCompile("" +
		`^([^(<]*?)` + // The beginning name of the user (no comment or key)
		`(?:\s*\((.*?)\))?` + // The optional comment
		`(?:\s*<(.*?)>)?$`) // The optional email address
	v := rxx.FindStringSubmatch(s)
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

func (i Identity) ToPgpUserID() *packet.UserId {
	return packet.NewUserId(i.Username, i.Comment, i.Email)

}

func KeybaseIdentity(un string) Identity {
	if len(un) == 0 {
		un = G.Env.GetUsername()
	}
	return Identity{
		Username: CANONICAL_HOST + "/" + un,
		Email:    un + "@" + CANONICAL_HOST,
	}
}

type Identities []Identity
