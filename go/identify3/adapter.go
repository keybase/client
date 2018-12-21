package identify3

import (
	"encoding/hex"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"sync"
)

// UIAdapter converts between the Identify2 UI that Identify2 engine expects, and the
// Identify3UI interface that the frontend is soon to implement. It's going to maintain the
// state machine that was previously implemented in JS.
type UIAdapter struct {
	sync.Mutex
	libkb.MetaContextified
	session     *libkb.Identify3Session
	ui          keybase1.Identify3UiInterface
	iFollowThem bool
	sentResult  bool
}

var _ libkb.IdentifyUI = (*UIAdapter)(nil)

func NewUIAdapter(mctx libkb.MetaContext, ui keybase1.Identify3UiInterface) (*UIAdapter, error) {
	ret := &UIAdapter{
		MetaContextified: libkb.NewMetaContextified(mctx),
		ui:               ui,
	}
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

func (i *UIAdapter) Start(string, keybase1.IdentifyReason, bool) error {
	return nil
}

// return true if we need an upgrade
func (i *UIAdapter) setRowStatus(arg *keybase1.Identify3UpdateRowArg, lcr keybase1.LinkCheckResult) bool {

	needUpgrade := false
	i.M().CDebugf("setRowStatus(%+v)", lcr)

	switch {

	// The proof worked, and either we tracked it as working, or we didn't track it at all.
	case (lcr.ProofResult.State == keybase1.ProofState_OK && (lcr.RemoteDiff == nil || lcr.RemoteDiff.Type == keybase1.TrackDiffType_NONE)):
		arg.Color = keybase1.Identify3RowColor_GREEN
		arg.State = keybase1.Identify3RowState_VALID

	// The proof worked, and it's new to us.
	case lcr.ProofResult.State == keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type == keybase1.TrackDiffType_NEW:
		arg.Color = keybase1.Identify3RowColor_BLUE
		arg.State = keybase1.Identify3RowState_VALID
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta("new"))
		needUpgrade = true

	// The proof worked, and it's upgraded.
	case lcr.ProofResult.State == keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type == keybase1.TrackDiffType_UPGRADED:
		arg.Color = keybase1.Identify3RowColor_BLUE
		arg.State = keybase1.Identify3RowState_VALID
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta("upgraded"))
		needUpgrade = true

	// The proof worked, we tracked failed, and now it's working
	case lcr.ProofResult.State == keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type == keybase1.TrackDiffType_REMOTE_WORKING:
		arg.Color = keybase1.Identify3RowColor_BLUE
		arg.State = keybase1.Identify3RowState_VALID
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta("upgraded"))
		needUpgrade = true

	// The proof failed, but we didn't track it
	case lcr.ProofResult.State != keybase1.ProofState_OK && lcr.RemoteDiff == nil:
		arg.Color = keybase1.Identify3RowColor_ORANGE
		arg.State = keybase1.Identify3RowState_WARNING
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta("unreachable"))

	// The proof failed, but we did "ignore" it, so it's OK
	case lcr.ProofResult.State != keybase1.ProofState_OK && (lcr.RemoteDiff == nil || lcr.RemoteDiff.Type == keybase1.TrackDiffType_NONE):
		arg.Color = keybase1.Identify3RowColor_ORANGE
		arg.State = keybase1.Identify3RowState_WARNING
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta("ignored"))

	// The proof failed, but we did "ignore" it via "SNOONZE", so it's OK, for now.
	case lcr.ProofResult.State != keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type == keybase1.TrackDiffType_NONE_VIA_TEMPORARY:
		arg.Color = keybase1.Identify3RowColor_YELLOW
		arg.State = keybase1.Identify3RowState_WARNING
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta("ignored"), keybase1.Identify3RowMeta("temporary"))

	// The proof failed, we did track it, and it didn't match our track
	case lcr.ProofResult.State != keybase1.ProofState_OK && lcr.RemoteDiff != nil && lcr.RemoteDiff.Type != keybase1.TrackDiffType_NONE:
		arg.Color = keybase1.Identify3RowColor_RED
		arg.State = keybase1.Identify3RowState_ERROR
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta("unreachable"))

	}
	return needUpgrade
}

func (i *UIAdapter) finishRemoteCheck(proof keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	if lcr.BreaksTracking {
		i.session.SetTrackBroken()
	}

	arg := keybase1.Identify3UpdateRowArg{
		Key:   proof.Key,
		Value: proof.Value,
	}

	if lcr.Hint != nil {
		arg.SiteURL = lcr.Hint.HumanUrl
		arg.ProofURL = lcr.Hint.ApiUrl
	}

	needUpgrade := i.setRowStatus(&arg, lcr)
	if needUpgrade {
		i.session.SetNeedUpgrade()
	}

	i.updateRow(arg)
	return nil
}

func (i *UIAdapter) FinishWebProofCheck(proof keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	return i.finishRemoteCheck(proof, lcr)
}

func (i *UIAdapter) FinishSocialProofCheck(proof keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	return i.finishRemoteCheck(proof, lcr)
}

func (i *UIAdapter) Confirm(*keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, nil
}

func (i *UIAdapter) DisplayCryptocurrency(keybase1.Cryptocurrency) error {
	return nil
}

func (i *UIAdapter) DisplayKey(key keybase1.IdentifyKey) error {
	if key.BreaksTracking {
		i.session.SetTrackBroken()
	}
	i.checkEldest(key)
	i.displayKey(key)
	return nil
}

func (i *UIAdapter) displayKey(key keybase1.IdentifyKey) {

	if key.PGPFingerprint == nil {
		return
	}

	arg := keybase1.Identify3UpdateRowArg{
		Key:   "pgp",
		Value: hex.EncodeToString(key.PGPFingerprint),
	}

	switch {
	case key.TrackDiff == nil || key.TrackDiff.Type == keybase1.TrackDiffType_NONE:
		arg.State = keybase1.Identify3RowState_VALID
		arg.Color = keybase1.Identify3RowColor_GREEN
	case key.TrackDiff != nil && key.TrackDiff.Type == keybase1.TrackDiffType_REVOKED:
		arg.State = keybase1.Identify3RowState_REVOKED
		arg.Color = keybase1.Identify3RowColor_RED
	case key.TrackDiff != nil && key.TrackDiff.Type == keybase1.TrackDiffType_NEW:
		arg.State = keybase1.Identify3RowState_VALID
		arg.Color = keybase1.Identify3RowColor_BLUE
		arg.Metas = append(arg.Metas, keybase1.Identify3RowMeta("new"))
	}

	i.updateRow(arg)
}

func (i *UIAdapter) checkEldest(key keybase1.IdentifyKey) {
	if key.TrackDiff == nil || key.TrackDiff.Type != keybase1.TrackDiffType_NEW_ELDEST {
		return
	}
	err := i.ui.Identify3UserReset(i.M().Ctx(), i.session.ID())
	if err != nil {
		i.M().CDebugf("Error sending user reset message: %s", err)
	}
	return
}

func (i *UIAdapter) ReportLastTrack(track *keybase1.TrackSummary) error {
	if track != nil {
		i.Lock()
		i.iFollowThem = true
		i.Unlock()
	}
	return nil
}

func (i *UIAdapter) plumbUncheckedProofs(proofs []keybase1.IdentifyRow) {
	for _, proof := range proofs {
		i.plumbUncheckedProof(proof)
	}
}

func (i *UIAdapter) plumbUncheckedProof(row keybase1.IdentifyRow) {
	i.updateRow(keybase1.Identify3UpdateRowArg{
		Key:   row.Proof.Key,
		Value: row.Proof.Value,
		State: keybase1.Identify3RowState_CHECKING,
		Color: keybase1.Identify3RowColor_GRAY,
	})
}

func (i *UIAdapter) updateRow(arg keybase1.Identify3UpdateRowArg) error {
	arg.GuiID = i.session.ID()
	err := i.ui.Identify3UpdateRow(i.M().Ctx(), arg)
	if err != nil {
		i.M().CDebugf("Failed to send update row (%+v): %s", arg, err)
	}
	return err
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

func (i *UIAdapter) sendResult(arg keybase1.Identify3ResultType) error {
	if i.shouldSkipSendResult() {
		i.M().CDebugf("Skipping send result, already done")
		return nil
	}

	err := i.ui.Identify3Result(i.M().Ctx(), arg)
	if err != nil {
		i.M().CDebugf("Failed to send result (%+v): %s", arg, err)
	}
	return err
}

func (i *UIAdapter) plumbCryptocurrency(crypto keybase1.Cryptocurrency) {
	i.updateRow(keybase1.Identify3UpdateRowArg{
		Key:   crypto.Type,
		Value: crypto.Address,
		State: keybase1.Identify3RowState_VALID,
		Color: keybase1.Identify3RowColor_GREEN,
	})
}

func (i *UIAdapter) plumbCryptocurrencies(cryptos []keybase1.Cryptocurrency) {
	for _, c := range cryptos {
		i.plumbCryptocurrency(c)
	}

}
func (i *UIAdapter) plumbRevoked(row keybase1.RevokedProof) {
	i.updateRow(keybase1.Identify3UpdateRowArg{
		Key:   row.Proof.Key,
		Value: row.Proof.Value,
		State: keybase1.Identify3RowState_REVOKED,
		Color: keybase1.Identify3RowColor_RED,
	})
}

func (i *UIAdapter) plumbRevokeds(rows []keybase1.RevokedProof) {
	for _, row := range rows {
		i.plumbRevoked(row)
	}
}

func (i *UIAdapter) LaunchNetworkChecks(id *keybase1.Identity, user *keybase1.User) error {

	if id.BreaksTracking {
		i.session.SetTrackBroken()
	}

	i.plumbUncheckedProofs(id.Proofs)
	i.plumbCryptocurrencies(id.Cryptocurrency)
	i.plumbRevokeds(id.RevokedDetails)

	return nil
}

func (i *UIAdapter) DisplayTrackStatement(string) error {
	return nil
}

func (i *UIAdapter) DisplayUserCard(card keybase1.UserCard) error {

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
	err := i.ui.Identify3UpdateUserCard(i.M().Ctx(), arg)
	if err != nil {
		i.M().CDebugf("Failed to send update card: %s", err)
	}
	return nil
}

func (i *UIAdapter) ReportTrackToken(token keybase1.TrackToken) error {
	outcome, err := i.M().G().TrackCache().Get(token)
	if err != nil {
		return err
	}
	i.session.SetOutcome(outcome)
	return nil
}

func (i *UIAdapter) Cancel() error {
	i.sendResult(keybase1.Identify3ResultType_CANCELED)
	return nil
}

func (i *UIAdapter) Finish() error {
	i.sendResult(i.session.ResultType())
	return nil
}
func (i *UIAdapter) DisplayTLFCreateWithInvite(keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}
func (i *UIAdapter) Dismiss(string, keybase1.DismissReason) error {
	return nil
}
