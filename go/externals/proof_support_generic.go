package externals

import (
	"fmt"
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// GenericProof
//

type GenericChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*GenericChecker)(nil)

func NewGenericChecker(p libkb.RemoteProofChainLink) (*GenericChecker, libkb.ProofError) {
	return &GenericChecker{p}, nil
}

func (rc *GenericChecker) GetTorError() libkb.ProofError { return nil }

func (rc *GenericChecker) CheckStatus(m libkb.MetaContext, h libkb.SigHint, _ libkb.ProofCheckerMode, pvlU libkb.PvlUnparsed) libkb.ProofError {
	// TODO will have to use the `check_url`/`check_path` config values to verify the proof.
	return nil
}

//
//=============================================================================

type GenericServiceType struct {
	libkb.BaseServiceType
	conf       keybase1.GenericServiceConfig
	usernameRe *regexp.Regexp
}

func NewGenericServiceType(conf keybase1.GenericServiceConfig) GenericServiceType {
	return GenericServiceType{
		conf:       conf,
		usernameRe: regexp.MustCompile(conf.UsernameRe),
	}
}

func (t GenericServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

func (t GenericServiceType) NormalizeUsername(s string) (string, error) {
	if !t.usernameRe.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	// TODO always normalize ToLower?
	return strings.ToLower(s), nil
}

func (t GenericServiceType) NormalizeRemoteName(m libkb.MetaContext, s string) (ret string, err error) {
	return t.NormalizeUsername(s)
}

func (t GenericServiceType) GetPrompt() string {
	return fmt.Sprintf("Your username on %s", t.conf.DisplayName)
}

func (t GenericServiceType) ToServiceJSON(username string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, username)
}

func (t GenericServiceType) PostInstructions(username string) *libkb.Markup {
	return libkb.FmtMarkup(fmt.Sprintf("Please visit <strong>%s</strong>, to complete the proof", t.conf.PrefillUrl))
}

func (t GenericServiceType) DisplayName(username string) string { return t.conf.DisplayName }
func (t GenericServiceType) GetTypeName() string                { return t.conf.Domain }

func (t GenericServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}
func (t GenericServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t GenericServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

func (t GenericServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &GenericChecker{l}
}

func (t GenericServiceType) IsDevelOnly() bool { return t.conf.IsDevel }

func (t GenericServiceType) FormatProofText(m libkb.MetaContext, ppr *libkb.PostProofRes) (res string, err error) {
	// TODO
	return "", fmt.Errorf("Not implemented")
}
