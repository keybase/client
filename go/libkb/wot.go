package libkb

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func getWotVouchChainLink(mctx MetaContext, uid keybase1.UID, sigID keybase1.SigID) (cl *WotVouchChainLink, voucher *User, err error) {
	// requires a full chain load
	user, err := LoadUser(NewLoadUserArgWithMetaContext(mctx).WithUID(uid).WithStubMode(StubModeUnstubbed))
	if err != nil {
		return nil, nil, fmt.Errorf("Error loading user: %v", err)
	}
	link := user.LinkFromSigID(sigID)
	if link == nil {
		return nil, nil, fmt.Errorf("Could not find link from sigID")
	}
	tlink, w := NewTypedChainLink(link)
	if w != nil {
		return nil, nil, fmt.Errorf("Could not get typed chain link: %v", w.Warning())
	}
	vlink, ok := tlink.(*WotVouchChainLink)
	if !ok {
		return nil, nil, fmt.Errorf("Link is not a WotVouchChainLink: %v", tlink)
	}
	return vlink, user, nil
}

func getWotReactChainLink(mctx MetaContext, user *User, sigID keybase1.SigID) (cl *WotReactChainLink, err error) {
	link := user.LinkFromSigID(sigID)
	if link == nil {
		return nil, fmt.Errorf("Could not find link from sigID")
	}
	tlink, w := NewTypedChainLink(link)
	if w != nil {
		return nil, fmt.Errorf("Could not get typed chain link: %v", w.Warning())
	}
	rlink, ok := tlink.(*WotReactChainLink)
	if !ok {
		return nil, fmt.Errorf("Link is not a WotReactChainLink: %v", tlink)
	}
	return rlink, nil
}

func assertVouchIsForUser(mctx MetaContext, vouchedUser wotExpansionUser, user *User) (err error) {
	if user.GetName() != vouchedUser.Username {
		return fmt.Errorf("wot username isn't expected %s != %s", user.GetName(), vouchedUser.Username)
	}
	if user.GetUID() != vouchedUser.UID {
		return fmt.Errorf("wot uid isn't me %s != %s", user.GetUID(), vouchedUser.UID)
	}
	if user.GetEldestKID() != vouchedUser.Eldest.KID {
		return fmt.Errorf("wot eldest kid isn't me %s != %s", user.GetEldestKID(), vouchedUser.Eldest.KID)
	}
	return nil
}

type wotExpansionUser struct {
	Eldest struct {
		KID   keybase1.KID
		Seqno keybase1.Seqno
	}
	SeqTail struct {
		PayloadHash string
		Seqno       keybase1.Seqno
		SigID       string
	}
	UID      keybase1.UID
	Username string
}

type vouchExpansion struct {
	User       wotExpansionUser    `json:"user"`
	Confidence keybase1.Confidence `json:"confidence"`
	VouchText  string              `json:"vouch_text"`
}

type reactionExpansion struct {
	SigID    keybase1.SigID `json:"sig_id"`
	Reaction string         `json:"reaction"`
}

type serverWotVouch struct {
	Voucher               keybase1.UID           `json:"voucher"`
	VoucherEldestSeqno    keybase1.Seqno         `json:"voucher_eldest_seqno"`
	Vouchee               keybase1.UID           `json:"vouchee"`
	VoucheeEldestSeqno    keybase1.Seqno         `json:"vouchee_eldest_seqno"`
	VouchSigID            keybase1.SigID         `json:"vouch_sig"`
	VouchExpansionJSON    string                 `json:"vouch_expansion"`
	ReactionSigID         *keybase1.SigID        `json:"reaction_sig,omitempty"`
	ReactionExpansionJSON *string                `json:"reaction_expansion,omitempty"`
	Status                keybase1.WotStatusType `json:"status"`
}

func transformUserVouch(mctx MetaContext, serverVouch serverWotVouch, voucheeUser *User) (res keybase1.WotVouch, err error) {
	// load the voucher and fetch the relevant chain link
	wotVouchLink, voucher, err := getWotVouchChainLink(mctx, serverVouch.Voucher, serverVouch.VouchSigID)
	if err != nil {
		return res, fmt.Errorf("error finding the vouch in the voucher's sigchain: %s", err.Error())
	}
	// extract the sig expansion
	expansionObject, err := ExtractExpansionObj(wotVouchLink.ExpansionID, serverVouch.VouchExpansionJSON)
	if err != nil {
		return res, fmt.Errorf("error extracting and validating the vouch expansion: %s", err.Error())
	}
	// load it into the right type for web-of-trust vouching
	var wotObj vouchExpansion
	err = json.Unmarshal(expansionObject, &wotObj)
	if err != nil {
		return res, fmt.Errorf("error casting vouch expansion object to expected web-of-trust schema: %s", err.Error())
	}

	if voucheeUser == nil || voucheeUser.GetUID() != serverVouch.Vouchee {
		// load vouchee
		voucheeUser, err = LoadUser(NewLoadUserArgWithMetaContext(mctx).WithUID(serverVouch.Vouchee).WithPublicKeyOptional().WithStubMode(StubModeUnstubbed))
		if err != nil {
			return res, fmt.Errorf("error loading vouchee to transform: %s", err.Error())
		}
	}

	err = assertVouchIsForUser(mctx, wotObj.User, voucheeUser)
	if err != nil {
		mctx.Debug("web-of-trust vouch user-section doesn't look right: %+v", wotObj.User)
		return res, fmt.Errorf("error verifying user section of web-of-trust expansion: %s", err.Error())
	}

	hasReaction := serverVouch.ReactionSigID != nil
	var reactionObj reactionExpansion
	var reactionStatus keybase1.WotReactionType
	var wotReactLink *WotReactChainLink
	if hasReaction {
		wotReactLink, err = getWotReactChainLink(mctx, voucheeUser, *serverVouch.ReactionSigID)
		if err != nil {
			return res, fmt.Errorf("error finding the vouch in the vouchee's sigchain: %s", err.Error())
		}
		// extract the sig expansion
		expansionObject, err = ExtractExpansionObj(wotReactLink.ExpansionID, *serverVouch.ReactionExpansionJSON)
		if err != nil {
			return res, fmt.Errorf("error extracting and validating the vouch expansion: %s", err.Error())
		}
		// load it into the right type for web-of-trust vouching
		err = json.Unmarshal(expansionObject, &reactionObj)
		if err != nil {
			return res, fmt.Errorf("error casting vouch expansion object to expected web-of-trust schema: %s", err.Error())
		}
		if reactionObj.SigID.String()[:30] != wotVouchLink.GetSigID().String()[:30] {
			return res, fmt.Errorf("reaction sigID doesn't match the original attestation: %s != %s", reactionObj.SigID, wotVouchLink.GetSigID())
		}
		reactionStatus = keybase1.WotReactionTypeMap[strings.ToUpper(reactionObj.Reaction)]
	}

	var status keybase1.WotStatusType
	switch {
	case wotVouchLink.revoked:
		status = keybase1.WotStatusType_REVOKED
	case wotReactLink != nil && wotReactLink.revoked:
		status = keybase1.WotStatusType_PROPOSED
	case !hasReaction:
		status = keybase1.WotStatusType_PROPOSED
	case reactionStatus == keybase1.WotReactionType_ACCEPT:
		status = keybase1.WotStatusType_ACCEPTED
	case reactionStatus == keybase1.WotReactionType_REJECT:
		status = keybase1.WotStatusType_REJECTED
	default:
		return res, fmt.Errorf("could not determine the status of web-of-trust from %s", voucher.GetName())
	}

	var proofs []keybase1.WotProofUI
	for _, proof := range wotObj.Confidence.Proofs {
		proofForUI, err := NewWotProofUI(mctx, proof)
		if err != nil {
			return res, err
		}
		proofs = append(proofs, proofForUI)
	}

	// build a WotVouch
	return keybase1.WotVouch{
		Status:          status,
		Vouchee:         voucheeUser.ToUserVersion(),
		VoucheeUsername: voucheeUser.GetNormalizedName().String(),
		Voucher:         voucher.ToUserVersion(),
		VoucherUsername: voucher.GetNormalizedName().String(),
		VouchText:       wotObj.VouchText,
		VouchProof:      serverVouch.VouchSigID,
		VouchedAt:       keybase1.ToTime(wotVouchLink.GetCTime()),
		Confidence:      wotObj.Confidence,
		Proofs:          proofs,
	}, nil
}

type apiWot struct {
	AppStatusEmbed
	Vouches []serverWotVouch `json:"webOfTrust"`
}

type FetchWotVouchesArg struct {
	Vouchee string
	Voucher string
}

func fetchWot(mctx MetaContext, vouchee string, voucher string) (res []serverWotVouch, err error) {
	defer mctx.Trace("fetchWot", &err)()
	apiArg := APIArg{
		Endpoint:    "wot/get",
		SessionType: APISessionTypeREQUIRED,
	}
	apiArg.Args = HTTPArgs{}
	if len(vouchee) > 0 {
		apiArg.Args["vouchee"] = S{Val: vouchee}
	}
	if len(voucher) > 0 {
		apiArg.Args["voucher"] = S{Val: voucher}
	}
	var response apiWot
	err = mctx.G().API.GetDecode(mctx, apiArg, &response)
	if err != nil {
		mctx.Debug("error fetching web-of-trust vouches: %s", err.Error())
		return nil, err
	}
	mctx.Debug("server returned %d web-of-trust vouches", len(response.Vouches))
	return response.Vouches, nil
}

// FetchWotVouches gets vouches written for vouchee (if specified) by voucher
// (if specified).
func FetchWotVouches(mctx MetaContext, arg FetchWotVouchesArg) (res []keybase1.WotVouch, err error) {
	vouches, err := fetchWot(mctx, arg.Vouchee, arg.Voucher)
	if err != nil {
		mctx.Debug("error fetching web-of-trust vouches for vouchee=%s by voucher=%s: %s", arg.Vouchee, arg.Voucher, err.Error())
		return nil, err
	}
	var voucheeUser *User
	if len(arg.Vouchee) > 0 {
		voucheeUser, err = LoadUser(NewLoadUserArgWithMetaContext(mctx).WithName(arg.Vouchee).WithPublicKeyOptional())
		if err != nil {
			return nil, fmt.Errorf("error loading vouchee: %s", err.Error())
		}
	}
	for _, serverVouch := range vouches {
		vouch, err := transformUserVouch(mctx, serverVouch, voucheeUser)
		if err != nil {
			mctx.Debug("error validating server-reported web-of-trust vouches for vouchee=%s by voucher=%s: %s", arg.Vouchee, arg.Voucher, err.Error())
			return nil, err
		}
		res = append(res, vouch)
	}
	mctx.Debug("found %d web-of-trust vouches for vouchee=%s by voucher=%s", len(res), arg.Vouchee, arg.Voucher)
	return res, nil
}

type _wotMsg struct {
	Voucher *string `json:"voucher,omitempty"`
	Vouchee *string `json:"vouchee,omitempty"`
}

func hasWotMsg(testable string) bool {
	for _, match := range []string{"wot.new_vouch", "wot.accepted", "wot.rejected"} {
		if match == testable {
			return true
		}
	}
	return false
}

func isDismissable(mctx MetaContext, category string, msg _wotMsg, voucher, vouchee kbun.NormalizedUsername) bool {
	voucherMatches := (msg.Voucher != nil && kbun.NewNormalizedUsername(*msg.Voucher) == voucher)
	voucheeMatches := (msg.Vouchee != nil && kbun.NewNormalizedUsername(*msg.Vouchee) == vouchee)
	me := mctx.ActiveDevice().Username(mctx)
	switch category {
	case "wot.new_vouch":
		return voucherMatches && (voucheeMatches || vouchee == me)
	case "wot.accepted", "wot.rejected":
		return voucheeMatches && (voucherMatches || voucher == me)
	default:
		return false
	}
}

func DismissWotNotifications(mctx MetaContext, voucherUsername, voucheeUsername string) (err error) {
	dismisser := mctx.G().GregorState
	state, err := mctx.G().GregorState.State(mctx.Ctx())
	if err != nil {
		return err
	}
	categoryPrefix, err := gregor1.ObjFactory{}.MakeCategory("wot")
	if err != nil {
		return err
	}
	items, err := state.ItemsWithCategoryPrefix(categoryPrefix)
	if err != nil {
		return err
	}
	var wotMsg _wotMsg
	for _, item := range items {
		category := item.Category().String()
		if !hasWotMsg(category) {
			continue
		}
		if err := json.Unmarshal(item.Body().Bytes(), &wotMsg); err != nil {
			return err
		}
		if isDismissable(mctx, category, wotMsg, kbun.NewNormalizedUsername(voucherUsername), kbun.NewNormalizedUsername(voucheeUsername)) {
			itemID := item.Metadata().MsgID()
			mctx.Debug("dismissing %s for %s,%s", category, voucherUsername, voucheeUsername)
			if err := dismisser.DismissItem(mctx.Ctx(), nil, itemID); err != nil {
				return err
			}
		}
	}
	return nil
}
