package libkb

import (
	"github.com/keybase/go-jsonw"
	"strings"
)

type ServiceType interface {
	AllStringKeys() []string
	PrimaryStringKeys() []string
	CheckUsername(string) bool
	NormalizeUsername(string) string
	ToChecker() Checker
	GetPrompt() string
	LastWriterWins() bool
	PreProofCheck(username string) error
	PreProofWarning(remotename string) *Markup
	ToServiceJson(remotename string) *jsonw.Wrapper
	PostInstructions(remotename string) *Markup
	DisplayName(username string) string
	RecheckProofPosting(tryNumber int, status int) (warning *Markup, err error)
	GetProofType() string
	CheckProofText(text string, id SigId, sig string) error
}

var _st_dispatch = make(map[string]ServiceType)

func RegisterServiceType(st ServiceType) {
	for _, k := range st.PrimaryStringKeys() {
		_st_dispatch[k] = st
	}
}

func GetServiceType(s string) ServiceType {
	return _st_dispatch[strings.ToLower(s)]
}
