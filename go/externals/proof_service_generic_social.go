package externals

import (
	"fmt"
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

const kbUsernameKey = "%{kb_username}"
const usernameKey = "%{username}"
const sigHashKey = "%{sig_hash}"

//=============================================================================
// GenericSocialProof
//

type GenericSocialProofChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*GenericSocialProofChecker)(nil)

func NewGenericSocialProofChecker(p libkb.RemoteProofChainLink) (*GenericSocialProofChecker, libkb.ProofError) {
	return &GenericSocialProofChecker{p}, nil
}

func (rc *GenericSocialProofChecker) GetTorError() libkb.ProofError { return nil }

func (rc *GenericSocialProofChecker) CheckStatus(m libkb.MetaContext, h libkb.SigHint, _ libkb.ProofCheckerMode, pvlU keybase1.MerkleStoreEntry) libkb.ProofError {
	// TODO will have to use the `check_url`/`check_path` config values to verify the proof.
	return libkb.NewProofError(keybase1.ProofStatus_BASE_HARD_ERROR, "Not implemented")
}

//
//=============================================================================

// Validated configuration from the server
type GenericSocialProofConfig struct {
	keybase1.ParamProofServiceConfig
	usernameRe *regexp.Regexp
}

func NewGenericSocialProofConfig(config keybase1.ParamProofServiceConfig) (*GenericSocialProofConfig, error) {
	gsConfig := &GenericSocialProofConfig{
		ParamProofServiceConfig: config,
		usernameRe:              nil,
	}
	err := gsConfig.validate()
	if err != nil {
		return nil, err
	}
	return gsConfig, nil
}

func (c *GenericSocialProofConfig) validate() error {
	re, err := regexp.Compile(c.Username.Re)
	if err != nil {
		return err
	}
	c.usernameRe = re
	if !strings.Contains(c.PrefillUrl, kbUsernameKey) {
		return fmt.Errorf("invalid PrefillUrl %s, missing %s", c.PrefillUrl, kbUsernameKey)
	}
	if !strings.Contains(c.PrefillUrl, sigHashKey) {
		return fmt.Errorf("invalid PrefillUrl %s, missing %s", c.PrefillUrl, sigHashKey)
	}
	if !strings.Contains(c.CheckUrl, usernameKey) {
		return fmt.Errorf("invalid CheckUrl %s, missing %s", c.CheckUrl, usernameKey)
	}
	return nil
}

func (c *GenericSocialProofConfig) prefillURLWithValues(username string, sigID keybase1.SigID) (string, error) {
	url := strings.Replace(c.PrefillUrl, kbUsernameKey, username, 1)
	url = strings.Replace(url, sigHashKey, sigID.String(), 1)
	if !strings.Contains(url, username) {
		return "", fmt.Errorf("Invalid PrefillUrl, missing username")
	}
	if !strings.Contains(url, sigID.String()) {
		return "", fmt.Errorf("Invalid PrefillUrl, missing sigHash")
	}
	return url, nil
}

//=============================================================================

type GenericSocialProofServiceType struct {
	libkb.BaseServiceType
	config *GenericSocialProofConfig
}

func NewGenericSocialProofServiceType(config *GenericSocialProofConfig) GenericSocialProofServiceType {
	return GenericSocialProofServiceType{
		config: config,
	}
}

func (t GenericSocialProofServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

func (t GenericSocialProofServiceType) NormalizeUsername(s string) (string, error) {
	if !t.config.usernameRe.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	// TODO always normalize ToLower?
	return strings.ToLower(s), nil
}

func (t GenericSocialProofServiceType) NormalizeRemoteName(m libkb.MetaContext, s string) (ret string, err error) {
	return t.NormalizeUsername(s)
}

func (t GenericSocialProofServiceType) GetPrompt() string {
	return fmt.Sprintf("Your username on %s", t.config.DisplayName)
}

func (t GenericSocialProofServiceType) ToServiceJSON(username string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, username)
}

func (t GenericSocialProofServiceType) PostInstructions(username string) *libkb.Markup {
	return libkb.FmtMarkup(`Please click on the following link to post to %v:`, t.config.DisplayName)
}

func (t GenericSocialProofServiceType) DisplayName(username string) string {
	return t.config.DisplayName
}
func (t GenericSocialProofServiceType) GetTypeName() string { return t.config.Domain }

func (t GenericSocialProofServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}

func (t GenericSocialProofServiceType) GetProofType() string {
	return libkb.GenericSocialWebServiceBinding
}

func (t GenericSocialProofServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	// We don't rely only any server trust in FormatProofText so there is nothing to verify here.
	return nil
}

func (t GenericSocialProofServiceType) FormatProofText(m libkb.MetaContext, ppr *libkb.PostProofRes, username string, sigID keybase1.SigID) (string, error) {
	return t.config.prefillURLWithValues(username, sigID)
}

func (t GenericSocialProofServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &GenericSocialProofChecker{l}
}

func (t GenericSocialProofServiceType) IsDevelOnly() bool { return false }

// We can post multiple generic social proofs to a single service.
func (t GenericSocialProofServiceType) LastWriterWins() bool { return false }
