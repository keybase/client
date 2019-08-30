package externals

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/keybase/client/go/jsonhelpers"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

const kbUsernameKey = "%{kb_username}"
const remoteUsernameKey = "%{username}"
const sigHashKey = "%{sig_hash}"
const kbUaKey = "%{kb_ua}"

//=============================================================================

// Validated configuration from the server
type GenericSocialProofConfig struct {
	keybase1.ParamProofServiceConfig
	usernameRe *regexp.Regexp
}

func NewGenericSocialProofConfig(g *libkb.GlobalContext, config keybase1.ParamProofServiceConfig) (*GenericSocialProofConfig, error) {
	gsConfig := &GenericSocialProofConfig{
		ParamProofServiceConfig: config,
	}
	if err := gsConfig.parseAndValidate(g); err != nil {
		return nil, err
	}
	return gsConfig, nil
}

func (c *GenericSocialProofConfig) parseAndValidate(g *libkb.GlobalContext) (err error) {
	if c.usernameRe, err = regexp.Compile(c.UsernameConfig.Re); err != nil {
		return err
	}
	if err = c.validatePrefillURL(); err != nil {
		return err
	}
	if err = c.validateCheckURL(); err != nil {
		return err
	}
	if err = c.validateProfileURL(); err != nil {
		return err
	}

	// In devel, we need to update the config url with the IP for the CI
	// container.
	if g.Env.GetRunMode() == libkb.DevelRunMode {
		serverURI, err := g.Env.GetServerURI()
		if err != nil {
			return err
		}

		c.ProfileUrl = strings.Replace(c.ProfileUrl, libkb.DevelServerURI, serverURI, 1)
		c.PrefillUrl = strings.Replace(c.PrefillUrl, libkb.DevelServerURI, serverURI, 1)
		c.CheckUrl = strings.Replace(c.CheckUrl, libkb.DevelServerURI, serverURI, 1)
	}

	return nil
}

func (c *GenericSocialProofConfig) validateProfileURL() error {
	if !strings.Contains(c.ProfileUrl, remoteUsernameKey) {
		return fmt.Errorf("invalid ProfileUrl: %s, missing: %s", c.ProfileUrl, remoteUsernameKey)
	}
	return nil
}

func (c *GenericSocialProofConfig) validatePrefillURL() error {
	if !strings.Contains(c.PrefillUrl, kbUsernameKey) {
		return fmt.Errorf("invalid PrefillUrl: %s, missing: %s", c.PrefillUrl, kbUsernameKey)
	}
	if !strings.Contains(c.PrefillUrl, remoteUsernameKey) {
		return fmt.Errorf("invalid PrefillUrl: %s, missing: %s", c.PrefillUrl, remoteUsernameKey)
	}
	if !strings.Contains(c.PrefillUrl, sigHashKey) {
		return fmt.Errorf("invalid PrefillUrl: %s, missing: %s", c.PrefillUrl, sigHashKey)
	}
	if !strings.Contains(c.PrefillUrl, kbUaKey) {
		return fmt.Errorf("invalid PrefillUrl: %s, missing: %s", c.PrefillUrl, kbUaKey)
	}
	return nil
}

func (c *GenericSocialProofConfig) validateCheckURL() error {
	if !strings.Contains(c.CheckUrl, remoteUsernameKey) {
		return fmt.Errorf("invalid CheckUrl: %s, missing: %s", c.CheckUrl, remoteUsernameKey)
	}
	return nil
}

func (c *GenericSocialProofConfig) profileURLWithValues(remoteUsername string) (string, error) {
	url := strings.Replace(c.ProfileUrl, remoteUsernameKey, remoteUsername, 1)
	if !strings.Contains(url, remoteUsername) {
		return "", fmt.Errorf("Invalid ProfileUrl: %s, missing remoteUsername: %s", url, remoteUsername)
	}
	return url, nil
}

func (c *GenericSocialProofConfig) prefillURLWithValues(kbUsername, remoteUsername string, sigID keybase1.SigID) (string, error) {
	remoteUsername = strings.ToLower(remoteUsername)
	url := strings.Replace(c.PrefillUrl, kbUsernameKey, kbUsername, 1)
	if !strings.Contains(url, kbUsername) {
		return "", fmt.Errorf("Invalid PrefillUrl: %s, missing kbUsername: %s", url, kbUsername)
	}
	url = strings.Replace(url, remoteUsernameKey, remoteUsername, 1)
	if !strings.Contains(url, remoteUsername) {
		return "", fmt.Errorf("Invalid PrefillUrl: %s, missing remoteUsername: %s", url, remoteUsername)
	}
	url = strings.Replace(url, sigHashKey, sigID.String(), 1)
	if !strings.Contains(url, sigID.String()) {
		return "", fmt.Errorf("Invalid PrefillUrl: %s, missing sigHash: %s", url, sigID)
	}
	url = strings.Replace(url, kbUaKey, libkb.ProofUserAgent(), 1)
	if !strings.Contains(url, libkb.ProofUserAgent()) {
		return "", fmt.Errorf("Invalid PrefillUrl: %s, missing kbUa: %s", url, libkb.ProofUserAgent())
	}
	return url, nil
}

func (c *GenericSocialProofConfig) checkURLWithValues(remoteUsername string) (string, error) {
	url := strings.Replace(c.CheckUrl, remoteUsernameKey, remoteUsername, 1)
	if !strings.Contains(strings.ToLower(url), strings.ToLower(remoteUsername)) {
		return "", fmt.Errorf("Invalid CheckUrl: %s, missing remoteUsername: %s", url, remoteUsername)
	}
	return url, nil
}

func (c *GenericSocialProofConfig) validateRemoteUsername(remoteUsername string) error {
	uc := c.UsernameConfig
	switch {
	case len(remoteUsername) < uc.Min:
		return fmt.Errorf("username must be at least %d characters, was %d", c.UsernameConfig.Min, len(remoteUsername))
	case len(remoteUsername) > uc.Max:
		return fmt.Errorf("username can be at most %d characters, was %d", c.UsernameConfig.Max, len(remoteUsername))
	case !c.usernameRe.MatchString(strings.ToLower(remoteUsername)):
		return libkb.NewBadUsernameError(remoteUsername)
	}
	return nil
}

//=============================================================================
// GenericSocialProof
//

type GenericSocialProofChecker struct {
	proof  libkb.RemoteProofChainLink
	config *GenericSocialProofConfig
}

var _ libkb.ProofChecker = (*GenericSocialProofChecker)(nil)

func NewGenericSocialProofChecker(proof libkb.RemoteProofChainLink, config *GenericSocialProofConfig) (*GenericSocialProofChecker, libkb.ProofError) {
	return &GenericSocialProofChecker{
		proof:  proof,
		config: config,
	}, nil
}

func (rc *GenericSocialProofChecker) GetTorError() libkb.ProofError { return nil }

func (rc *GenericSocialProofChecker) CheckStatus(mctx libkb.MetaContext, _ libkb.SigHint, _ libkb.ProofCheckerMode,
	pvlU keybase1.MerkleStoreEntry) (_ *libkb.SigHint, retErr libkb.ProofError) {
	mctx = mctx.WithLogTag("PCS")
	defer mctx.TraceTimed("GenericSocialProofChecker.CheckStatus", func() error { return retErr })()

	_, sigID, err := libkb.OpenSig(rc.proof.GetArmoredSig())
	if err != nil {
		return nil, libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %v", err)
	}

	remoteUsername := rc.proof.GetRemoteUsername()
	if err := rc.config.validateRemoteUsername(remoteUsername); err != nil {
		return nil, libkb.NewProofError(keybase1.ProofStatus_BAD_USERNAME,
			"remoteUsername %s was invalid: %v", remoteUsername, err)
	}

	apiURL, err := rc.config.checkURLWithValues(remoteUsername)
	if err != nil {
		return nil, libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad api url: %v", err)
	}

	if _, err = url.Parse(apiURL); err != nil {
		return nil, libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE,
			"Could not parse url: '%v'", apiURL)
	}

	res, err := mctx.G().GetExternalAPI().Get(mctx, libkb.APIArg{
		Endpoint: apiURL,
	})
	if err != nil {
		return nil, libkb.XapiError(err, apiURL)
	}

	// We expect a single result to match which contains an array of proofs.
	results, perr := jsonhelpers.AtSelectorPath(res.Body, rc.config.CheckPath, mctx.Debug, libkb.NewInvalidPVLSelectorError)
	if perrInner, _ := perr.(libkb.ProofError); perrInner != nil {
		return nil, perrInner
	}

	if len(results) != 1 {
		return nil, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Json selector did not match any values")
	}
	var proofs []keybase1.ParamProofJSON
	if err = results[0].UnmarshalAgain(&proofs); err != nil {
		return nil, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Json could not be deserialized")
	}

	var foundProof, foundUsername bool
	for _, proof := range proofs {
		if proof.KbUsername == rc.proof.GetUsername() && sigID.Equal(proof.SigHash) {
			foundProof = true
			break
		}
		// Report if we found any matching usernames but the signature didn't match.
		foundUsername = foundUsername || proof.KbUsername == rc.proof.GetUsername()
	}
	if !foundProof {
		if foundUsername {
			return nil, libkb.NewProofError(keybase1.ProofStatus_NOT_FOUND,
				"Unable to find the proof, signature mismatch")
		}
		return nil, libkb.NewProofError(keybase1.ProofStatus_NOT_FOUND,
			"Unable to find the proof")
	}

	humanURL, err := rc.config.profileURLWithValues(remoteUsername)
	if err != nil {
		mctx.Debug("Unable to generate humanURL for verifiedSigHint: %v", err)
		humanURL = ""
	}
	verifiedSigHint := libkb.NewVerifiedSigHint(sigID, "" /* remoteID */, apiURL, humanURL, "" /* checkText */)
	return verifiedSigHint, nil
}

//=============================================================================

type GenericSocialProofServiceType struct {
	libkb.BaseServiceType
	config *GenericSocialProofConfig
}

func NewGenericSocialProofServiceType(config *GenericSocialProofConfig) *GenericSocialProofServiceType {
	return &GenericSocialProofServiceType{
		config: config,
	}
}

func (t *GenericSocialProofServiceType) Key() string { return t.GetTypeName() }

func (t *GenericSocialProofServiceType) NormalizeUsername(s string) (string, error) {
	if err := t.config.validateRemoteUsername(s); err != nil {
		return "", err
	}
	return strings.ToLower(s), nil
}

func (t *GenericSocialProofServiceType) NormalizeRemoteName(mctx libkb.MetaContext, s string) (ret string, err error) {
	return t.NormalizeUsername(s)
}

func (t *GenericSocialProofServiceType) GetPrompt() string {
	return fmt.Sprintf("Your username on %s", t.config.DisplayName)
}

func (t *GenericSocialProofServiceType) ToServiceJSON(username string) *jsonw.Wrapper {
	ret := t.BaseToServiceJSON(t, username)
	if strings.HasPrefix(strings.ToLower(t.DisplayGroup()), "mastodon") {
		_ = ret.SetKey("form", jsonw.NewString("mastodon"))
	}
	return ret
}

func (t *GenericSocialProofServiceType) PostInstructions(username string) *libkb.Markup {
	return libkb.FmtMarkup(`Please click on the following link to post to %v:`, t.config.DisplayName)
}

func (t *GenericSocialProofServiceType) DisplayName() string {
	return t.config.DisplayName
}
func (t *GenericSocialProofServiceType) GetTypeName() string   { return t.config.Domain }
func (t *GenericSocialProofServiceType) PickerSubtext() string { return t.config.Domain }

func (t *GenericSocialProofServiceType) ProfileURL(remoteUsername string) (string, error) {
	return t.config.profileURLWithValues(remoteUsername)
}

func (t *GenericSocialProofServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}

func (t *GenericSocialProofServiceType) GetProofType() string {
	return libkb.GenericSocialWebServiceBinding
}

func (t *GenericSocialProofServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	// We don't rely only any server trust in FormatProofText so there is nothing to verify here.
	return nil
}

func (t *GenericSocialProofServiceType) FormatProofText(m libkb.MetaContext, ppr *libkb.PostProofRes,
	kbUsername, remoteUsername string, sigID keybase1.SigID) (string, error) {
	return t.config.prefillURLWithValues(kbUsername, remoteUsername, sigID)
}

func (t *GenericSocialProofServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &GenericSocialProofChecker{
		proof:  l,
		config: t.config,
	}
}

func (t *GenericSocialProofServiceType) IsDevelOnly() bool { return false }

func (t *GenericSocialProofServiceType) ProveParameters(mctx libkb.MetaContext) keybase1.ProveParameters {
	subtext := t.config.Description
	if len(subtext) == 0 {
		subtext = t.DisplayName()
	}
	return keybase1.ProveParameters{
		LogoFull:    MakeIcons(mctx, t.GetLogoKey(), "logo_full", 64),
		LogoBlack:   MakeIcons(mctx, t.GetLogoKey(), "logo_black", 16),
		Title:       t.config.Domain,
		Subtext:     subtext,
		Suffix:      fmt.Sprintf("@%v", t.config.Domain),
		ButtonLabel: fmt.Sprintf("Authorize on %v", t.config.Domain),
	}
}
