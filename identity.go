package libkb

import (
	"fmt"
	"regexp"
	"strings"
)

type Identity struct {
	Username string
	Comment  string
	Email    string
}

func ParseIdentity(s string) (*Identity, error) {
	rxx := regexp.MustCompile(
		`^([^(<]*?)` + // The beginning name of the user (no comment or key)
			`(?:\s*\((.*?)\))?` + // The optional comment
			`(?:\s*<(.*?)>)?$`) // The optional email address
	v := rxx.FindStringSubmatch(s)
	if v == nil {
		return nil, fmt.Errorf("Bad PGP-style identity: %s", s)
	} else {
		ret := &Identity{
			Username: v[1],
			Comment:  v[2],
			Email:    v[3],
		}
		return ret, nil
	}
}

func (i Identity) Format() string {
	parts := make([]string, 0, 3)
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
