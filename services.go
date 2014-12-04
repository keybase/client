package libkb

import (
	"github.com/keybase/go-jsonw"
	"regexp"
	"strings"
)

type ServiceType interface {
	AllStringKeys() []string
	PrimaryStringKeys() []string
	CheckUsername(string) bool
	NormalizeUsername(string) (string, error)
	ToChecker() Checker
	GetPrompt() string
	LastWriterWins() bool
	PreProofCheck(username string) (*Markup, error)
	PreProofWarning(remotename string) *Markup
	ToServiceJson(remotename string) *jsonw.Wrapper
	PostInstructions(remotename string) *Markup
	DisplayName(username string) string
	RecheckProofPosting(tryNumber int, status int) (warning *Markup, err error)
	GetProofType() string
	GetTypeName() string
	CheckProofText(text string, id SigId, sig string) error
	FormatProofText(*PostProofRes) (string, error)
	GetApiArgKey() string
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

//=============================================================================

type BaseServiceType struct{}

func (t BaseServiceType) BaseCheckProofTextShort(text string, id SigId, med bool) (err error) {
	blocks := FindBase64Snippets(text)
	var target string
	if med {
		target = id.ToMediumId()
	} else {
		target = id.ToShortId()
	}
	for _, b := range blocks {
		if len(b) < len(target) {
		} else if b != target {
			err = WrongSigError{b}
			return
		} else {
			return
		}
	}
	err = NotFoundError{"Couldn't find signature ID " + target + " in text"}
	return
}

func (t BaseServiceType) BaseRecheckProofPosting(tryNumber, status int) (warning *Markup, err error) {
	warning = FmtMarkup("Couldn't find posted proof.")
	return
}

func (t BaseServiceType) BaseToServiceJson(st ServiceType, un string) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("name", jsonw.NewString(st.GetTypeName()))
	ret.SetKey("username", jsonw.NewString(un))
	return ret
}

func (t BaseServiceType) BaseGetProofType(st ServiceType) string {
	return "web_service_binding." + st.GetTypeName()
}

func (t BaseServiceType) BaseToChecker(st ServiceType, hint string) Checker {
	return Checker{
		F:             func(s string) bool { return st.CheckUsername(s) },
		Hint:          hint,
		PreserveSpace: false,
	}
}

func (t BaseServiceType) BaseAllStringKeys(st ServiceType) []string {
	return []string{st.GetTypeName()}
}

func (t BaseServiceType) BasePrimaryStringKeys(st ServiceType) []string {
	return []string{st.GetTypeName()}
}

func (t BaseServiceType) LastWriterWins() bool                      { return true }
func (t BaseServiceType) PreProofCheck(string) (*Markup, error)     { return nil, nil }
func (t BaseServiceType) PreProofWarning(remotename string) *Markup { return nil }

func (t BaseServiceType) FormatProofText(ppr *PostProofRes) (string, error) {
	return ppr.Text, nil
}

func (t BaseServiceType) BaseCheckProofTextFull(text string, id SigId, sig string) (err error) {
	blocks := FindBase64Blocks(text)
	target := FindFirstBase64Block(sig)
	if len(target) == 0 {
		err = BadSigError{"Generated sig was invalid"}
		return
	}
	found := false
	for _, b := range blocks {
		if len(b) < 80 {
		} else if b != target {
			err = WrongSigError{b}
			return
		} else {
			found = true
		}
	}
	if !found {
		err = NotFoundError{"Couldn't find signature ID " + target + " in text"}
	}
	return
}

func (t BaseServiceType) NormalizeUsername(s string) (string, error) {
	return strings.ToLower(s), nil
}

func (t BaseServiceType) BaseCheckProofForUrl(text string, id SigId) (err error) {
	url_rxx := regexp.MustCompile(`https://(\S+)`)
	target := id.ToMediumId()
	urls := url_rxx.FindAllString(text, -1)
	G.Log.Debug("Found urls %v", urls)
	found := false
	for _, u := range urls {
		if strings.HasSuffix(u, target) {
			found = true
		}
	}
	if !found {
		err = NotFoundError{"Didn't find a URL with suffix '" + target + "'"}
	}
	return
}

func (t BaseServiceType) GetApiArgKey() string {
	return "remote_username"
}

//=============================================================================
