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
// ParamProof
//

type ParamProofChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*ParamProofChecker)(nil)

func NewParamProofChecker(p libkb.RemoteProofChainLink) (*ParamProofChecker, libkb.ProofError) {
	return &ParamProofChecker{p}, nil
}

func (rc *ParamProofChecker) GetTorError() libkb.ProofError { return nil }

func (rc *ParamProofChecker) CheckStatus(m libkb.MetaContext, h libkb.SigHint, _ libkb.ProofCheckerMode, pvlU keybase1.MerkleStoreEntry) libkb.ProofError {
	// TODO will have to use the `check_url`/`check_path` config values to verify the proof.
	return libkb.NewProofError(keybase1.ProofStatus_BASE_HARD_ERROR, "Not implemented")
}

//
//=============================================================================

type ParamProofServiceType struct {
	libkb.BaseServiceType
	conf       keybase1.ParamProofServiceConfig
	usernameRe *regexp.Regexp
}

func NewParamProofServiceType(conf keybase1.ParamProofServiceConfig) ParamProofServiceType {
	return ParamProofServiceType{
		conf: conf,
		// NOTE: configuration regexes are validated when retrieved from the
		// server, this serves as a final initialization sanity check. If we
		// end up doing more validation we should make a validated type that
		// has the clean values coming from proofServes.parseServices
		usernameRe: regexp.MustCompile(conf.Username.Re),
	}
}

func (t ParamProofServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

func (t ParamProofServiceType) NormalizeUsername(s string) (string, error) {
	if !t.usernameRe.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	// TODO always normalize ToLower?
	return strings.ToLower(s), nil
}

func (t ParamProofServiceType) NormalizeRemoteName(m libkb.MetaContext, s string) (ret string, err error) {
	return t.NormalizeUsername(s)
}

func (t ParamProofServiceType) GetPrompt() string {
	return fmt.Sprintf("Your username on %s", t.conf.DisplayName)
}

func (t ParamProofServiceType) ToServiceJSON(username string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, username)
}

func (t ParamProofServiceType) PostInstructions(username string) *libkb.Markup {
	return libkb.FmtMarkup(`Please click on the following link to post to %v:`, t.conf.DisplayName)
}

func (t ParamProofServiceType) DisplayName(username string) string { return t.conf.DisplayName }
func (t ParamProofServiceType) GetTypeName() string                { return t.conf.Domain }

func (t ParamProofServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}
func (t ParamProofServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t ParamProofServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return fmt.Errorf("Not implemented")
}

func (t ParamProofServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &ParamProofChecker{l}
}

func (t ParamProofServiceType) IsDevelOnly() bool { return false }

func (t ParamProofServiceType) FormatProofText(m libkb.MetaContext, ppr *libkb.PostProofRes) (res string, err error) {
	// TODO
	//url := strings.replace(t.conf.PrefillUrl, usernameKey, username, 1)
	//url = strings.replace(url, sigHashKey, ppr.ID, 1)
	//return libkb.FmtMarkup(fmt.Sprintf("Please visit <strong>%s</strong>, to complete the proof", url))
	// NOTE whenever this interpolation gets implemented copying func
	// substituteExact from pvl/helpers.go could be a good way.
	return "", fmt.Errorf("Not implemented")
}
