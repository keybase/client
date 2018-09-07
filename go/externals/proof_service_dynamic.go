package externals

import (
	"fmt"
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

const usernameKey = "{{username}}"
const sigHashKey = "{{sig_hash}}"

//=============================================================================
// DynamicProof
//

type DynamicProofChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*DynamicProofChecker)(nil)

func NewDynamicProofChecker(p libkb.RemoteProofChainLink) (*DynamicProofChecker, libkb.ProofError) {
	return &DynamicProofChecker{p}, nil
}

func (rc *DynamicProofChecker) GetTorError() libkb.ProofError { return nil }

func (rc *DynamicProofChecker) CheckStatus(m libkb.MetaContext, h libkb.SigHint, _ libkb.ProofCheckerMode, pvlU libkb.PvlUnparsed) libkb.ProofError {
	// TODO will have to use the `check_url`/`check_path` config values to verify the proof.
	return libkb.NewProofError(keybase1.ProofStatus_BASE_HARD_ERROR, "Not implemented")
}

//
//=============================================================================

type DynamicProofServiceType struct {
	libkb.BaseServiceType
	conf       keybase1.DynamicProofServiceConfig
	usernameRe *regexp.Regexp
}

func NewDynamicProofServiceType(conf keybase1.DynamicProofServiceConfig) DynamicProofServiceType {
	return DynamicProofServiceType{
		conf: conf,
		// TODO the loader will have to validate the config from the server and
		// disable invalid ones without blowing up. CORE-8655
		usernameRe: regexp.MustCompile(conf.UsernameRe),
	}
}

func (t DynamicProofServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

func (t DynamicProofServiceType) NormalizeUsername(s string) (string, error) {
	if !t.usernameRe.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	// TODO always normalize ToLower?
	return strings.ToLower(s), nil
}

func (t DynamicProofServiceType) NormalizeRemoteName(m libkb.MetaContext, s string) (ret string, err error) {
	return t.NormalizeUsername(s)
}

func (t DynamicProofServiceType) GetPrompt() string {
	return fmt.Sprintf("Your username on %s", t.conf.DisplayName)
}

func (t DynamicProofServiceType) ToServiceJSON(username string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, username)
}

func (t DynamicProofServiceType) PostInstructions(username string) *libkb.Markup {
	return libkb.FmtMarkup(`Please click on the following link to post to %v:`, t.conf.DisplayName)
}

func (t DynamicProofServiceType) DisplayName(username string) string { return t.conf.DisplayName }
func (t DynamicProofServiceType) GetTypeName() string                { return t.conf.Domain }

func (t DynamicProofServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}
func (t DynamicProofServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t DynamicProofServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

func (t DynamicProofServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &DynamicProofChecker{l}
}

func (t DynamicProofServiceType) IsDevelOnly() bool { return t.conf.IsDevel }

func (t DynamicProofServiceType) FormatProofText(m libkb.MetaContext, ppr *libkb.PostProofRes) (res string, err error) {
	//url := strings.replace(t.conf.PrefillUrl, usernameKey, username, 1)
	//url = strings.replace(url, sigHashKey, ppr.ID, 1)
	//return libkb.FmtMarkup(fmt.Sprintf("Please visit <strong>%s</strong>, to complete the proof", url))
	// TODO
	return "", fmt.Errorf("Not implemented")
}
