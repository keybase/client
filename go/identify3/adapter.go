package identify3

import (
	"encoding/hex"
	"fmt"
	"strings"
	"sync"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// UIAdapter converts between the Identify2 UI that Identify2 engine expects, and the
// Identify3UI interface that the frontend is soon to implement. It's going to maintain the
// state machine that was previously implemented in JS.
type UIAdapter struct {
	sync.Mutex
	session     *libkb.Identify3Session
	ui          keybase1.Identify3UiInterface
	username    string
	iFollowThem bool
	sentResult  bool
	// An upcall is when the service initiates the ID interaction.
	// An downcall is when the frontend initiates the ID.
	// Probably as directed by KBFS or the CLI.
	// "Tell Nojima we're about to hit him."
	isUpcall    bool
	priorityMap map[string]int // map from proof key to display priority
}

var _ libkb.IdentifyUI = (*UIAdapter)(nil)

func NewUIAdapter(mctx libkb.MetaContext, ui keybase1.Identify3UiInterface) (*UIAdapter, error) {
	ret := &UIAdapter{
		ui: ui,
	}
	ret.initPriorityMap(mctx)
	return ret, nil
}

func NewUIAdapterMakeSession(mctx libkb.MetaContext, ui keybase1.Identify3UiInterface, guiid keybase1.Identify3GUIID) (ret *UIAdapter, err error) {
	sess := libkb.NewIdentify3SessionWithID(mctx, guiid)
	err = mctx.G().Identify3State.Put(sess)
	if err != nil {
		return nil, err
	}

	ret, err = NewUIAdapterWithSession(mctx, ui, sess)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func NewUIAdapterMakeSessionForUpcall(mctx libkb.MetaContext, ui keybase1.Identify3UiInterface) (ret *UIAdapter, err error) {
	guiid, err := libkb.NewIdentify3GUIID()
	if err != nil {
		return nil, err
	}
	ret, err = NewUIAdapterMakeSession(mctx, ui, guiid)
	if err != nil {
		return nil, err
	}
	ret.isUpcall = true
	return ret, nil
}

func NewUIAdapterWithSession(mctx libkb.MetaContext, ui keybase1.Identify3UiInterface, sess *libkb.Identify3Session) (*UIAdapter, error) {
	ret, err := NewUIAdapter(mctx, ui)
	if err != nil {
		return nil, err
	}
	ret.session = sess
	return ret, nil
}

func (i *UIAdapter) Start(mctx libkb.MetaContext, user string, reason keybase1.IdentifyReason, force bool) error {
	i.Lock()
	i.username = user
	i.Unlock()

	if !i.isUpcall {
		return nil
	}
	arg := keybase1.Identify3ShowTrackerArg{
		GuiID:        i.session.ID(),
		Assertion:    keybase1.Identify3Assertion(user),
		Reason:       reason,
		ForceDisplay: true,
	}

	err := i.ui.Identify3ShowTracker(mctx.Ctx(), arg)
	if err != nil {
		mctx.Debug("Failed to call Identify3ShowTracker: %s", err)
	}
	return err
}

func (i *UIAdapter) initPriorityMap(mctx libkb.MetaContext) {
	i.priorityMap = make(map[string]int)
	var haveDisplayConfigs bool
	for _, displayConfig := range mctx.G().GetProofServices().ListDisplayConfigs(mctx) {
		haveDisplayConfigs = true
		i.priorityMap[displayConfig.Key] = displayConfig.Priority
		var altKey string
		switch displayConfig.Key {
		case "zcash.t", "zcash.z", "zcash.s":
			altKey = "zcash"
		case "bitcoin":
			altKey = "btc"
		case "http", "https", "dns":
			altKey = "web"
		}
		if len(altKey) > 0 {
			if _, ok := i.priorityMap[altKey]; !ok {
				i.priorityMap[altKey] = displayConfig.Priority
			}
		}
	}
	if !haveDisplayConfigs {
		i.priorityMap["twitter"] = 1
		i.priorityMap["https"] = 100
		i.priorityMap["http"] = 101
		i.priorityMap["dns"] = 102
		i.priorityMap["pgp"] = 103
		i.priorityMap["bitcoin"] = 104
		i.priorityMap["zcash.s"] = 105
		i.priorityMap["zcash.z"] = 106
		i.priorityMap["zcash.t"] = 107
		i.priorityMap["stellar"] = 108
		i.priorityMap["github"] = 2
		i.priorityMap["reddit"] = 3
		i.priorityMap["hackernews"] = 4
		i.priorityMap["facebook"] = 5
	}
}

func (i *UIAdapter) priority(key string) int {
	if i.priorityMap == nil {
		return 0 // should be impossible but don't crash.
	}
	p, ok := i.priorityMap[key]
	if !ok {
		// Put it at the bottom of the list.
		return 9999999
	}
	return p
}

func (i *UIAdapter) getColorForValid(following bool) keybase1.Identify3RowColor {
	if following {
		return keybase1.Identify3RowColor_GREEN
	}
	return keybase1.Identify3RowColor_BLUE
}

// return true if we need an upgrade
func (i *UIAdapter) setRowStatus(mctx libkb.MetaContext, arg *keybase1.Identify3Row, lcr keybase1.LinkCheckResult) bool {

	needUpgrade := false
	mctx.Debug("ID3: setRowStatus(lcr: %+v, cached: %+v, diff: %+v, remoteDiff: %+v, hint: %+v)",
		lcr, lcr.Cached, lcr.Diff, lcr.RemoteDiff, lcr.Hint)

	switch {
	// The proof worked, and either we tracked it as working, or we didn't track it at all.
	case (lcr.ProofResult.State == keybase1.ProofState_OK && (lcr.RemoteDiff == nil || lcr.RemoteDiff.Type == keybase1.TrackDiffType_NONE)):
		arg.Color = i.getColorForValid(lcr.RemoteDiff != nil)
		arg.State = keybase1.Identify3RowState_VALID

	// The proof worked, and it's new to us.
	case lcr.ProofResult.State == keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type == keybase1.TrackDiffType_NEW:
		arg.Color = keybase1.Identify3RowColor_BLUE
		arg.State = keybase1.Identify3RowState_VALID
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta{Color: arg.Color, Label: "new"})
		needUpgrade = true

	// The proof worked, and it's upgraded.
	case lcr.ProofResult.State == keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type == keybase1.TrackDiffType_UPGRADED:
		arg.Color = keybase1.Identify3RowColor_BLUE
		arg.State = keybase1.Identify3RowState_VALID
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta{Color: arg.Color, Label: "upgraded"})
		needUpgrade = true

	// The proof worked, we tracked failed, and now it's working
	case lcr.ProofResult.State == keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type == keybase1.TrackDiffType_REMOTE_WORKING:
		arg.Color = keybase1.Identify3RowColor_BLUE
		arg.State = keybase1.Identify3RowState_VALID
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta{Color: arg.Color, Label: "new"})
		needUpgrade = true

	// The proof failed, but we didn't track it
	case lcr.ProofResult.State != keybase1.ProofState_OK && lcr.RemoteDiff == nil:
		arg.Color = keybase1.Identify3RowColor_ORANGE
		arg.State = keybase1.Identify3RowState_WARNING
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta{Color: arg.Color, Label: "unreachable"})

	// The proof failed, but we did "ignore" it, so it's OK
	case lcr.ProofResult.State != keybase1.ProofState_OK && (lcr.RemoteDiff == nil || lcr.RemoteDiff.Type == keybase1.TrackDiffType_NONE):
		arg.Color = keybase1.Identify3RowColor_GREEN
		arg.State = keybase1.Identify3RowState_WARNING
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta{Color: arg.Color, Label: "ignored"})

	// The proof failed, but we did "ignore" it via "SNOONZE", so it's OK, for now.
	case lcr.ProofResult.State != keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type == keybase1.TrackDiffType_NONE_VIA_TEMPORARY:
		arg.Color = keybase1.Identify3RowColor_YELLOW
		arg.State = keybase1.Identify3RowState_WARNING
		arg.Metas = append(arg.Metas,
			keybase1.Identify3RowMeta{Color: arg.Color, Label: "ignored"},
			keybase1.Identify3RowMeta{Color: arg.Color, Label: "temporary"},
		)

	// The proof failed, we did track it, and it didn't match our track
	case lcr.ProofResult.State != keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type != keybase1.TrackDiffType_NONE:
		arg.Color = keybase1.Identify3RowColor_RED
		arg.State = keybase1.Identify3RowState_ERROR
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta{Color: arg.Color, Label: "unreachable"})

	default:
		mctx.Warning("unhandled ID3 setRowStatus")

	}
	return needUpgrade
}

func (i *UIAdapter) rowPartial(mctx libkb.MetaContext, proof keybase1.RemoteProof, lcr *keybase1.LinkCheckResult) (row keybase1.Identify3Row) {
	row = keybase1.Identify3Row{
		Key:      proof.Key,
		Value:    proof.Value,
		SigID:    proof.SigID,
		Ctime:    proof.MTime, // It's what we've got.
		Priority: i.priority(proof.Key),
	}

	var humanURLOrSigchainURL string
	if lcr != nil && lcr.Hint != nil {
		humanURLOrSigchainURL = lcr.Hint.HumanUrl
	}
	if len(humanURLOrSigchainURL) == 0 {
		humanURLOrSigchainURL = i.makeSigchainViewURL(mctx, proof.SigID)
	}

	iconKey := proof.Key
	row.ProofURL = humanURLOrSigchainURL
	switch proof.ProofType {
	case keybase1.ProofType_TWITTER:
		row.SiteURL = fmt.Sprintf("https://twitter.com/%v", proof.Value)
		iconKey = "twitter"
	case keybase1.ProofType_GITHUB:
		row.SiteURL = fmt.Sprintf("https://github.com/%v", proof.Value)
		iconKey = "github"
	case keybase1.ProofType_REDDIT:
		row.SiteURL = fmt.Sprintf("https://reddit.com/user/%v", proof.Value)
		iconKey = "reddit"
	case keybase1.ProofType_HACKERNEWS:
		// hackernews profile urls must have the username in its original casing.
		username := proof.Value
		if libkb.Cicmp(proof.Value, proof.DisplayMarkup) {
			username = proof.DisplayMarkup
		}
		row.SiteURL = fmt.Sprintf("https://news.ycombinator.com/user?id=%v", username)
		iconKey = "hackernews"
	case keybase1.ProofType_FACEBOOK:
		row.SiteURL = fmt.Sprintf("https://facebook.com/%v", proof.Value)
		iconKey = "facebook"
	case keybase1.ProofType_GENERIC_SOCIAL:
		row.SiteURL = humanURLOrSigchainURL
		serviceType := mctx.G().GetProofServices().GetServiceType(mctx.Ctx(), proof.Key)
		if serviceType != nil {
			if serviceType, ok := serviceType.(*externals.GenericSocialProofServiceType); ok {
				profileURL, err := serviceType.ProfileURL(proof.Value)
				if err == nil {
					row.SiteURL = profileURL
				}
			}
			iconKey = serviceType.GetLogoKey()
		} else {
			iconKey = proof.Key
		}
		row.ProofURL = i.makeSigchainViewURL(mctx, proof.SigID)
	case keybase1.ProofType_GENERIC_WEB_SITE:
		protocol := "https"
		if proof.Key != "https" {
			protocol = "http"
		}
		row.SiteURL = fmt.Sprintf("%v://%v", protocol, proof.Value)
		iconKey = "web"
	case keybase1.ProofType_DNS:
		row.SiteURL = fmt.Sprintf("http://%v", proof.Value)
		row.ProofURL = i.makeSigchainViewURL(mctx, proof.SigID)
		iconKey = "web"
	default:
		row.SiteURL = humanURLOrSigchainURL
	}
	row.SiteIcon = externals.MakeIcons(mctx, iconKey, "logo_black", 16)
	row.SiteIconFull = externals.MakeIcons(mctx, iconKey, "logo_full", 64)
	return row
}

func (i *UIAdapter) finishRemoteCheck(mctx libkb.MetaContext, proof keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	if lcr.BreaksTracking {
		i.session.SetTrackBroken()
	}

	arg := i.rowPartial(mctx, proof, &lcr)
	needUpgrade := i.setRowStatus(mctx, &arg, lcr)
	if needUpgrade {
		i.session.SetNeedUpgrade()
	}

	i.updateRow(mctx, arg)
	return nil
}

func (i *UIAdapter) FinishWebProofCheck(mctx libkb.MetaContext, proof keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	return i.finishRemoteCheck(mctx, proof, lcr)
}

func (i *UIAdapter) FinishSocialProofCheck(mctx libkb.MetaContext, proof keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	return i.finishRemoteCheck(mctx, proof, lcr)
}

func (i *UIAdapter) Confirm(libkb.MetaContext, *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, nil
}

func (i *UIAdapter) DisplayCryptocurrency(mctx libkb.MetaContext, cc keybase1.Cryptocurrency) error {
	i.plumbCryptocurrency(mctx, cc)
	return nil
}

func (i *UIAdapter) DisplayStellarAccount(mctx libkb.MetaContext, s keybase1.StellarAccount) error {
	i.plumbStellarAccount(mctx, s)
	return nil
}

func (i *UIAdapter) DisplayKey(mctx libkb.MetaContext, key keybase1.IdentifyKey) error {
	if key.BreaksTracking {
		i.session.SetTrackBroken()
	}
	i.checkEldest(mctx, key)
	i.displayKey(mctx, key)
	return nil
}

func (i *UIAdapter) displayKey(mctx libkb.MetaContext, key keybase1.IdentifyKey) {
	if key.PGPFingerprint == nil {
		return
	}

	arg := keybase1.Identify3Row{
		Key:      "pgp",
		Value:    hex.EncodeToString(key.PGPFingerprint),
		SigID:    key.SigID,
		Ctime:    0,
		Priority: i.priority("pgp"),
		SiteURL:  i.makeKeybaseProfileURL(mctx),
		// key.SigID is blank if the PGP key was there pre-sigchain
		ProofURL:     i.makeSigchainViewURL(mctx, key.SigID),
		SiteIcon:     externals.MakeIcons(mctx, "pgp", "logo_black", 16),
		SiteIconFull: externals.MakeIcons(mctx, "pgp", "logo_full", 64),
		Kid:          &key.KID,
	}

	switch {
	case key.TrackDiff == nil || key.TrackDiff.Type == keybase1.TrackDiffType_NONE:
		arg.State = keybase1.Identify3RowState_VALID
		arg.Color = i.getColorForValid(key.TrackDiff != nil)
	case key.TrackDiff != nil && (key.TrackDiff.Type == keybase1.TrackDiffType_REVOKED || key.TrackDiff.Type == keybase1.TrackDiffType_NEW_ELDEST):
		arg.State = keybase1.Identify3RowState_REVOKED
		arg.Color = keybase1.Identify3RowColor_RED
	case key.TrackDiff != nil && key.TrackDiff.Type == keybase1.TrackDiffType_NEW:
		arg.State = keybase1.Identify3RowState_VALID
		arg.Color = keybase1.Identify3RowColor_BLUE
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta{Color: arg.Color, Label: "new"})
	default:
		mctx.Warning("unhandled ID3 setRowStatus in displayKey: %+v", key)
	}

	i.updateRow(mctx, arg)
}

func (i *UIAdapter) checkEldest(mctx libkb.MetaContext, key keybase1.IdentifyKey) {
	if key.TrackDiff == nil || key.TrackDiff.Type != keybase1.TrackDiffType_NEW_ELDEST {
		return
	}
	err := i.ui.Identify3UserReset(mctx.Ctx(), i.session.ID())
	if err != nil {
		mctx.Debug("Error sending user reset message: %s", err)
	}
}

func (i *UIAdapter) ReportLastTrack(mctx libkb.MetaContext, track *keybase1.TrackSummary) error {
	if track != nil {
		i.Lock()
		i.iFollowThem = true
		i.Unlock()
	}
	return nil
}

func (i *UIAdapter) plumbUncheckedProofs(mctx libkb.MetaContext, proofs []keybase1.IdentifyRow) {
	for _, proof := range proofs {
		i.plumbUncheckedProof(mctx, proof)
	}
}

func (i *UIAdapter) plumbUncheckedProof(mctx libkb.MetaContext, row keybase1.IdentifyRow) {
	arg := i.rowPartial(mctx, row.Proof, nil)
	arg.State = keybase1.Identify3RowState_CHECKING
	arg.Color = keybase1.Identify3RowColor_GRAY
	i.updateRow(mctx, arg)
}

func (i *UIAdapter) updateRow(mctx libkb.MetaContext, arg keybase1.Identify3Row) {
	arg.GuiID = i.session.ID()
	err := i.ui.Identify3UpdateRow(mctx.Ctx(), arg)
	mctx.Debug("update row %+v", arg)
	if err != nil {
		mctx.Debug("Failed to send update row (%+v): %s", arg, err)
	}
}

func (i *UIAdapter) shouldSkipSendResult() bool {
	i.Lock()
	defer i.Unlock()
	if i.sentResult {
		return true
	}
	i.sentResult = true
	return false
}

func (i *UIAdapter) sendResult(mctx libkb.MetaContext, typ keybase1.Identify3ResultType) error {
	if i.shouldSkipSendResult() {
		mctx.Debug("Skipping send result, already done")
		return nil
	}
	arg := keybase1.Identify3ResultArg{
		GuiID:  i.session.ID(),
		Result: typ,
	}

	err := i.ui.Identify3Result(mctx.Ctx(), arg)
	if err != nil {
		mctx.Debug("Failed to send result (%+v): %s", arg, err)
	}
	return err
}

func (i *UIAdapter) makeKeybaseProfileURL(mctx libkb.MetaContext) string {
	url := libkb.SiteURILookup[mctx.G().Env.GetRunMode()]
	var parts []string
	if url == "" {
		return url
	}
	parts = append(parts, url, i.username)
	return strings.Join(parts, "/")
}

func (i *UIAdapter) makeSigchainViewURL(mctx libkb.MetaContext, s keybase1.SigID) string {
	url := libkb.SiteURILookup[mctx.G().Env.GetRunMode()]
	var parts []string
	if url == "" {
		return url
	}
	parts = append(parts, url, i.username)
	page := "sigchain"
	if !s.IsNil() {
		page = page + "#" + s.String()
	}
	parts = append(parts, page)
	return strings.Join(parts, "/")
}

func (i *UIAdapter) plumbCryptocurrency(mctx libkb.MetaContext, crypto keybase1.Cryptocurrency) {
	key := crypto.Type
	switch crypto.Family {
	case string(libkb.CryptocurrencyFamilyBitcoin):
		key = "btc"
	case string(libkb.CryptocurrencyFamilyZCash):
		key = "zcash"
	default:
		mctx.Debug("unrecgonized crypto family: %v, %v", crypto.Type, crypto.Family)
	}
	i.updateRow(mctx, keybase1.Identify3Row{
		Key:          key,
		Value:        crypto.Address,
		Priority:     i.priority(key),
		State:        keybase1.Identify3RowState_VALID,
		Color:        i.getColorForValid(i.iFollowThem),
		SigID:        crypto.SigID,
		Ctime:        0,
		SiteURL:      i.makeSigchainViewURL(mctx, crypto.SigID),
		SiteIcon:     externals.MakeIcons(mctx, key, "logo_black", 16),
		SiteIconFull: externals.MakeIcons(mctx, key, "logo_full", 64),
		ProofURL:     i.makeSigchainViewURL(mctx, crypto.SigID),
	})
}

func (i *UIAdapter) plumbStellarAccount(mctx libkb.MetaContext, str keybase1.StellarAccount) {
	i.updateRow(mctx, keybase1.Identify3Row{
		Key:          "stellar",
		Value:        str.FederationAddress,
		Priority:     i.priority("stellar"),
		State:        keybase1.Identify3RowState_VALID,
		Color:        i.getColorForValid(i.iFollowThem),
		SigID:        str.SigID,
		Ctime:        0,
		SiteURL:      i.makeSigchainViewURL(mctx, str.SigID),
		SiteIcon:     externals.MakeIcons(mctx, "stellar", "logo_black", 16),
		SiteIconFull: externals.MakeIcons(mctx, "stellar", "logo_full", 64),
		ProofURL:     i.makeSigchainViewURL(mctx, str.SigID),
	})
}

func (i *UIAdapter) plumbRevoked(mctx libkb.MetaContext, row keybase1.RevokedProof) {
	arg := i.rowPartial(mctx, row.Proof, nil)
	arg.State = keybase1.Identify3RowState_REVOKED
	arg.Color = keybase1.Identify3RowColor_RED
	arg.Metas = append(arg.Metas,
		keybase1.Identify3RowMeta{Color: arg.Color, Label: "revoked"},
	)
	i.updateRow(mctx, arg)
}

func (i *UIAdapter) plumbRevokeds(mctx libkb.MetaContext, rows []keybase1.RevokedProof) {
	for _, row := range rows {
		i.plumbRevoked(mctx, row)
	}
}

func (i *UIAdapter) LaunchNetworkChecks(mctx libkb.MetaContext, id *keybase1.Identity, user *keybase1.User) error {

	if id.BreaksTracking {
		i.session.SetTrackBroken()
	}
	i.plumbUncheckedProofs(mctx, id.Proofs)
	i.plumbRevokeds(mctx, id.RevokedDetails)

	return nil
}

func (i *UIAdapter) DisplayTrackStatement(libkb.MetaContext, string) error {
	return nil
}

func (i *UIAdapter) DisplayUserCard(mctx libkb.MetaContext, card keybase1.UserCard) error {

	// Do not take the server's word on this! Overwrite with what we got above.
	// Depends on the fact this gets called after ReportLastTrack, which is currently
	// the case.
	i.Lock()
	card.YouFollowThem = i.iFollowThem
	i.Unlock()

	arg := keybase1.Identify3UpdateUserCardArg{
		GuiID: i.session.ID(),
		Card:  card,
	}
	err := i.ui.Identify3UpdateUserCard(mctx.Ctx(), arg)
	if err != nil {
		mctx.Debug("Failed to send update card: %s", err)
	}
	return nil
}

func (i *UIAdapter) ReportTrackToken(mctx libkb.MetaContext, token keybase1.TrackToken) error {
	outcome, err := mctx.G().TrackCache().Get(token)
	if err != nil {
		return err
	}
	i.session.SetOutcome(outcome)
	return nil
}

func (i *UIAdapter) Cancel(mctx libkb.MetaContext) error {
	_ = i.sendResult(mctx, keybase1.Identify3ResultType_CANCELED)
	return nil
}

func (i *UIAdapter) Finish(mctx libkb.MetaContext) error {
	_ = i.sendResult(mctx, i.session.ResultType())
	return nil
}
func (i *UIAdapter) DisplayTLFCreateWithInvite(libkb.MetaContext, keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}
func (i *UIAdapter) Dismiss(libkb.MetaContext, string, keybase1.DismissReason) error {
	return nil
}
