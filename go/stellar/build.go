package stellar

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/stellar/remote"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/slotctx"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
	stellarAddress "github.com/stellar/go/address"
)

func ShouldOfferAdvancedSend(mctx libkb.MetaContext, remoter remote.Remoter, from, to stellar1.AccountID) (shouldShow stellar1.AdvancedBanner, err error) {
	theirBalances, err := remoter.Balances(mctx.Ctx(), to)
	if err != nil {
		return stellar1.AdvancedBanner_NO_BANNER, err
	}
	for _, bal := range theirBalances {
		if !bal.Asset.IsNativeXLM() {
			return stellar1.AdvancedBanner_RECEIVER_BANNER, nil
		}
	}

	// Lookup our assets
	ourBalances, err := remoter.Balances(mctx.Ctx(), from)
	if err != nil {
		return stellar1.AdvancedBanner_NO_BANNER, err
	}
	for _, bal := range ourBalances {
		asset := bal.Asset
		if !asset.IsNativeXLM() {
			return stellar1.AdvancedBanner_SENDER_BANNER, nil
		}
	}

	// Neither of us have non-native assets so return false
	return stellar1.AdvancedBanner_NO_BANNER, nil
}

func GetSendAssetChoicesLocal(mctx libkb.MetaContext, remoter remote.Remoter, arg stellar1.GetSendAssetChoicesLocalArg) (res []stellar1.SendAssetChoiceLocal, err error) {
	owns, _, err := OwnAccount(mctx, arg.From)
	if err != nil {
		return res, err
	}
	if !owns {
		return res, fmt.Errorf("account %s is not owned by current user", arg.From)
	}

	ourBalances, err := remoter.Balances(mctx.Ctx(), arg.From)
	if err != nil {
		return res, err
	}

	res = []stellar1.SendAssetChoiceLocal{}
	for _, bal := range ourBalances {
		asset := bal.Asset
		if asset.IsNativeXLM() {
			// We are only doing non-native assets here.
			continue
		}
		choice := stellar1.SendAssetChoiceLocal{
			Asset:   asset,
			Enabled: true,
			Left:    bal.Asset.Code,
			Right:   bal.Asset.Issuer,
		}
		res = append(res, choice)
	}

	if arg.To != "" {
		recipient, err := LookupRecipient(mctx, stellarcommon.RecipientInput(arg.To), false)
		if err != nil {
			mctx.G().Log.CDebugf(mctx.Ctx(), "Skipping asset filtering: LookupRecipient for %q failed with: %s",
				arg.To, err)
			return res, nil
		}

		theirBalancesHash := make(map[string]bool)
		assetHashCode := func(a stellar1.Asset) string {
			return fmt.Sprintf("%s%s%s", a.Type, a.Code, a.Issuer)
		}

		if recipient.AccountID != nil {
			theirBalances, err := remoter.Balances(mctx.Ctx(), stellar1.AccountID(recipient.AccountID.String()))
			if err != nil {
				mctx.G().Log.CDebugf(mctx.Ctx(), "Skipping asset filtering: remoter.Balances for %q failed with: %s",
					recipient.AccountID, err)
				return res, nil
			}
			for _, bal := range theirBalances {
				theirBalancesHash[assetHashCode(bal.Asset)] = true
			}
		}

		for i, choice := range res {
			available := theirBalancesHash[assetHashCode(choice.Asset)]
			if !available {
				choice.Enabled = false
				recipientStr := "Recipient"
				if recipient.User != nil {
					recipientStr = recipient.User.Username.String()
				}
				choice.Subtext = fmt.Sprintf("%s does not accept %s", recipientStr, choice.Asset.Code)
				res[i] = choice
			}
		}
	}
	return res, nil
}

func StartBuildPaymentLocal(mctx libkb.MetaContext) (res stellar1.BuildPaymentID, err error) {
	return getGlobal(mctx.G()).startBuildPayment(mctx)
}

func StopBuildPaymentLocal(mctx libkb.MetaContext, bid stellar1.BuildPaymentID) {
	getGlobal(mctx.G()).stopBuildPayment(mctx, bid)
}

func BuildPaymentLocal(mctx libkb.MetaContext, arg stellar1.BuildPaymentLocalArg) (res stellar1.BuildPaymentResLocal, err error) {
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "BuildPaymentLocal", true)
	defer tracer.Finish()

	var data *buildPaymentData
	var release func()
	if arg.Bid.IsNil() {
		// Compatibility for pre-bid gui and tests.
		mctx = mctx.WithCtx(
			getGlobal(mctx.G()).buildPaymentSlot.Use(mctx.Ctx(), arg.SessionID))
	} else {
		mctx, data, release, err = getGlobal(mctx.G()).acquireBuildPayment(mctx, arg.Bid, arg.SessionID)
		defer release()
		if err != nil {
			return res, err
		}

		// Mark the payment as not ready to send while the new values are validated.
		data.ReadyToReview = false
		data.ReadyToSend = false
		data.Frozen = nil
	}

	readyChecklist := struct {
		from       bool
		to         bool
		amount     bool
		secretNote bool
		publicMemo bool
	}{}
	log := func(format string, args ...interface{}) {
		mctx.Debug("bpl: "+format, args...)
	}

	bpc := getGlobal(mctx.G()).getBuildPaymentCache()
	if bpc == nil {
		return res, fmt.Errorf("missing build payment cache")
	}

	// -------------------- from --------------------

	tracer.Stage("from")
	fromInfo := struct {
		available bool
		from      stellar1.AccountID
	}{}
	if arg.FromPrimaryAccount != arg.From.IsNil() {
		// Exactly one of `arg.From` and `arg.FromPrimaryAccount` must be set.
		return res, fmt.Errorf("invalid build payment parameters")
	}
	fromPrimaryAccount := arg.FromPrimaryAccount
	if arg.FromPrimaryAccount {
		primaryAccountID, err := bpc.PrimaryAccount(mctx)
		if err != nil {
			log("PrimaryAccount -> err:[%T] %v", err, err)
			res.Banners = append(res.Banners, stellar1.SendBannerLocal{
				Level:   "error",
				Message: fmt.Sprintf("Could not find primary account.%v", msgMore(err)),
			})
		} else {
			fromInfo.from = primaryAccountID
			fromInfo.available = true
		}
	} else {
		owns, fromPrimary, err := getGlobal(mctx.G()).OwnAccountCached(mctx, arg.From)
		if err != nil || !owns {
			log("OwnsAccount (from) -> owns:%v err:[%T] %v", owns, err, err)
			res.Banners = append(res.Banners, stellar1.SendBannerLocal{
				Level:   "error",
				Message: fmt.Sprintf("Could not find source account.%v", msgMore(err)),
			})
		} else {
			fromInfo.from = arg.From
			fromInfo.available = true
			fromPrimaryAccount = fromPrimary
		}
	}
	if fromInfo.available {
		res.From = fromInfo.from
		readyChecklist.from = true
	}

	// -------------------- to --------------------

	tracer.Stage("to")
	var recipientUV keybase1.UserVersion
	skipRecipient := len(arg.To) == 0
	var minAmountXLM string
	if !skipRecipient && arg.ToIsAccountID {
		_, err := libkb.ParseStellarAccountID(arg.To)
		if err != nil {
			res.ToErrMsg = err.Error()
			skipRecipient = true
		} else {
			readyChecklist.to = true
		}
	}
	if !skipRecipient {
		recipient, err := bpc.LookupRecipient(mctx, stellarcommon.RecipientInput(arg.To))
		if err != nil {
			log("error with recipient field %v: %v", arg.To, err)
			res.ToErrMsg = "Recipient not found."
		} else {
			bannerThey := "they"
			bannerTheir := "their"
			if recipient.User != nil && !arg.ToIsAccountID {
				bannerThey = recipient.User.Username.String()
				bannerTheir = fmt.Sprintf("%s's", recipient.User.Username)
				recipientUV = recipient.User.UV
			}
			if recipient.AccountID == nil && fromInfo.available && !fromPrimaryAccount {
				// This would have been a relay from a non-primary account.
				// We cannot allow that.
				res.Banners = append(res.Banners, stellar1.SendBannerLocal{
					Level:   "error",
					Message: fmt.Sprintf("Because %v hasn’t set up their wallet yet, you can only send to them from your default account.", bannerThey),
				})
			} else {
				readyChecklist.to = true
				addMinBanner := func(them, amount string) {
					res.Banners = append(res.Banners, stellar1.SendBannerLocal{
						Level:   "info",
						Message: fmt.Sprintf("Because it's %s first transaction, you must send at least %s XLM.", them, amount),
					})
				}
				var sendingToSelf bool
				var selfSendErr error
				if recipient.AccountID == nil {
					// Sending a payment to a target with no account. (relay)
					minAmountXLM = "2.01"
					addMinBanner(bannerTheir, minAmountXLM)
				} else {
					sendingToSelf, _, selfSendErr = getGlobal(mctx.G()).OwnAccountCached(mctx, stellar1.AccountID(recipient.AccountID.String()))
					isFunded, err := bpc.IsAccountFunded(mctx, stellar1.AccountID(recipient.AccountID.String()), arg.Bid)
					if err != nil {
						log("error checking recipient funding status %v: %v", *recipient.AccountID, err)
					} else if !isFunded {
						// Sending to a non-funded stellar account.
						minAmountXLM = "1"
						log("OwnsAccount (to) -> owns:%v err:%v", sendingToSelf, selfSendErr)
						if !sendingToSelf || selfSendErr != nil {
							// Likely sending to someone else's account.
							addMinBanner(bannerTheir, minAmountXLM)
						} else {
							// Sending to our own account.
							res.Banners = append(res.Banners, stellar1.SendBannerLocal{
								Level:   "info",
								Message: fmt.Sprintf("Because it's the first transaction on your receiving account, you must send at least %v XLM.", minAmountXLM),
							})
						}
					}
				}
				if fromInfo.available && !sendingToSelf && !fromPrimaryAccount {
					res.Banners = append(res.Banners, stellar1.SendBannerLocal{
						Level:   "info",
						Message: "Your Keybase username will not be linked to this transaction.",
					})
				}

				if recipient.AccountID != nil {
					tracer.Stage("offer advanced send")
					offerAdvancedForm, err := bpc.ShouldOfferAdvancedSend(mctx, arg.From, stellar1.AccountID(*recipient.AccountID))
					if err == nil {
						if offerAdvancedForm != stellar1.AdvancedBanner_NO_BANNER {
							res.Banners = append(res.Banners, stellar1.SendBannerLocal{
								Level:                 "info",
								OfferAdvancedSendForm: offerAdvancedForm,
							})
						}
					} else {
						log("error determining whether to offer the advanced send page: %v", err)
					}
				}
			}
		}
	}

	// -------------------- amount + asset --------------------

	tracer.Stage("amount + asset")
	bpaArg := buildPaymentAmountArg{
		Bid:      arg.Bid,
		Amount:   arg.Amount,
		Currency: arg.Currency,
		Asset:    arg.Asset,
	}
	if fromInfo.available {
		bpaArg.From = &fromInfo.from
	}
	amountX := buildPaymentAmountHelper(mctx, bpc, bpaArg)
	res.AmountErrMsg = amountX.amountErrMsg
	res.WorthDescription = amountX.worthDescription
	res.WorthInfo = amountX.worthInfo
	res.WorthCurrency = amountX.worthCurrency
	res.DisplayAmountXLM = amountX.displayAmountXLM
	res.DisplayAmountFiat = amountX.displayAmountFiat
	res.SendingIntentionXLM = amountX.sendingIntentionXLM

	if amountX.haveAmount {
		if !amountX.asset.IsNativeXLM() {
			return res, fmt.Errorf("sending non-XLM assets is not supported")
		}
		readyChecklist.amount = true

		if fromInfo.available {
			// Check that the sender has enough asset available.
			// Note: When adding support for sending non-XLM assets, check the asset instead of XLM here.
			availableToSendXLM, err := bpc.AvailableXLMToSend(mctx, fromInfo.from)
			if err != nil {
				log("error getting available balance: %v", err)
			} else {
				baseFee := getGlobal(mctx.G()).BaseFee(mctx)
				availableToSendXLM = SubtractFeeSoft(mctx, availableToSendXLM, baseFee)
				availableToSendFormatted := availableToSendXLM + " XLM"
				availableToSendXLMFmt, err := FormatAmount(mctx,
					availableToSendXLM, false, stellarnet.Truncate)
				if err == nil {
					availableToSendFormatted = availableToSendXLMFmt + " XLM"
				}
				if arg.Currency != nil && amountX.rate != nil {
					// If the user entered an amount in outside currency and an exchange
					// rate is available, attempt to show them available balance in that currency.
					availableToSendOutside, err := stellarnet.ConvertXLMToOutside(availableToSendXLM, amountX.rate.Rate)
					if err != nil {
						log("error converting available-to-send", err)
					} else {
						formattedATS, err := FormatCurrencyWithCodeSuffix(mctx,
							availableToSendOutside, amountX.rate.Currency, stellarnet.Truncate)
						if err != nil {
							log("error formatting available-to-send", err)
						} else {
							availableToSendFormatted = formattedATS
						}
					}
				}
				cmp, err := stellarnet.CompareStellarAmounts(availableToSendXLM, amountX.amountOfAsset)
				switch {
				case err != nil:
					log("error comparing amounts (%v) (%v): %v", availableToSendXLM, amountX.amountOfAsset, err)
				case cmp == -1:
					log("Send amount is more than available to send %v > %v", amountX.amountOfAsset, availableToSendXLM)
					readyChecklist.amount = false // block sending
					available, err := stellarnet.ParseStellarAmount(availableToSendXLM)
					if err != nil {
						mctx.Debug("error parsing available balance: %v", err)
						available = 0
					}

					if available <= 0 {
						// "You only have 0 worth of Lumens" looks ugly
						if arg.Currency != nil {
							res.AmountErrMsg = fmt.Sprintf("You have *%s* worth of Lumens available to send.", availableToSendFormatted)
						} else {
							res.AmountErrMsg = fmt.Sprintf("You have *%s* available to send.", availableToSendFormatted)
						}
					} else {
						if arg.Currency != nil {
							res.AmountErrMsg = fmt.Sprintf("You only have *%s* worth of Lumens available to send.", availableToSendFormatted)
						} else {
							res.AmountErrMsg = fmt.Sprintf("You only have *%s* available to send.", availableToSendFormatted)
						}
					}
				default:
					// Welcome back. How was your stay at the error handling hotel?
					res.AmountAvailable = availableToSendFormatted + " available"
				}
			}
		}

		if minAmountXLM != "" {
			cmp, err := stellarnet.CompareStellarAmounts(amountX.amountOfAsset, minAmountXLM)
			switch {
			case err != nil:
				log("error comparing amounts", err)
			case cmp == -1:
				// amount is less than minAmountXLM
				readyChecklist.amount = false // block sending
				res.AmountErrMsg = fmt.Sprintf("You must send at least *%s XLM*", minAmountXLM)
			}
		}

		// Note: When adding support for sending non-XLM assets, check here that the recipient accepts the asset.
	}

	// helper so the GUI doesn't have to call FormatCurrency separately
	if arg.Currency != nil {
		res.WorthAmount = amountX.amountOfAsset
	}

	// -------------------- note + memo --------------------

	tracer.Stage("note + memo")
	if len(arg.SecretNote) <= libkb.MaxStellarPaymentNoteLength {
		readyChecklist.secretNote = true
	} else {
		res.SecretNoteErrMsg = "Note is too long."
	}

	if len(arg.PublicMemo) <= libkb.MaxStellarPaymentPublicNoteLength {
		readyChecklist.publicMemo = true
	} else {
		res.PublicMemoErrMsg = "Memo is too long."
	}

	// -------------------- end --------------------

	if readyChecklist.from && readyChecklist.to && readyChecklist.amount && readyChecklist.secretNote && readyChecklist.publicMemo {
		res.ReadyToReview = true

		if data != nil {
			// Mark the payment as ready to review.
			data.ReadyToReview = true
			data.ReadyToSend = false
			data.Frozen = &frozenPayment{
				From:          fromInfo.from,
				To:            arg.To,
				ToUV:          recipientUV,
				ToIsAccountID: arg.ToIsAccountID,
				Amount:        amountX.amountOfAsset,
				Asset:         amountX.asset,
			}
		}
	}

	// Return the context's error.
	// If just `nil` were returned then in the event of a cancellation
	// resilient parts of this function could hide it, causing
	// a bogus return value.
	return res, mctx.Ctx().Err()
}

type reviewButtonState string

const reviewButtonSpinning = "spinning"
const reviewButtonEnabled = "enabled"
const reviewButtonDisabled = "disabled"

func ReviewPaymentLocal(mctx libkb.MetaContext, stellarUI stellar1.UiInterface, arg stellar1.ReviewPaymentLocalArg) (err error) {
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "ReviewPaymentLocal", true)
	defer tracer.Finish()

	if arg.Bid.IsNil() {
		return fmt.Errorf("missing payment ID")
	}

	mctx, data, release, err := getGlobal(mctx.G()).acquireBuildPayment(mctx, arg.Bid, arg.SessionID)
	defer release()
	if err != nil {
		return err
	}

	seqno := 0
	notify := func(banners []stellar1.SendBannerLocal, nextButton reviewButtonState) chan struct{} {
		seqno++
		seqno := seqno                    // Shadow seqno to freeze it for the goroutine below.
		receivedCh := make(chan struct{}) // channel closed when the notification has been acked.
		mctx.Debug("sending UIPaymentReview bid:%v sessionID:%v seqno:%v nextButton:%v banners:%v",
			arg.Bid, arg.SessionID, seqno, nextButton, len(banners))
		for _, banner := range banners {
			mctx.Debug("banner: %+v", banner)
		}
		go func() {
			err := stellarUI.PaymentReviewed(mctx.Ctx(), stellar1.PaymentReviewedArg{
				SessionID: arg.SessionID,
				Msg: stellar1.UIPaymentReviewed{
					Bid:        arg.Bid,
					ReviewID:   arg.ReviewID,
					Seqno:      seqno,
					Banners:    banners,
					NextButton: string(nextButton),
				},
			})
			if err != nil {
				mctx.Debug("error in response to UIPaymentReview: %v", err)
			}
			close(receivedCh)
		}()
		return receivedCh
	}

	if !data.ReadyToReview {
		// Caller goofed.
		<-notify([]stellar1.SendBannerLocal{{
			Level:   "error",
			Message: "This payment is not ready to review",
		}}, reviewButtonDisabled)
		return fmt.Errorf("this payment is not ready to review")
	}
	if data.Frozen == nil {
		// Should be impossible.
		return fmt.Errorf("this payment is missing values")
	}

	notify(nil, reviewButtonSpinning)

	wantFollowingCheck := true

	if data.Frozen.ToIsAccountID {
		mctx.Debug("skipping identify for account ID recipient: %v", data.Frozen.To)
		data.ReadyToSend = true
		wantFollowingCheck = false
	}

	recipientAssertion := data.Frozen.To
	// how would you have this before identify?  from LookupRecipient?
	// does that mean that identify is happening twice?
	recipientUV := data.Frozen.ToUV

	// check if it is a federation address
	if strings.Contains(recipientAssertion, stellarAddress.Separator) {
		name, domain, err := stellarAddress.Split(recipientAssertion)
		// if there is an error, let this fall through and get identified
		if err == nil {
			if domain != "keybase.io" {
				mctx.Debug("skipping identify for federation address recipient: %s", data.Frozen.To)
				data.ReadyToSend = true
				wantFollowingCheck = false
			} else {
				mctx.Debug("identifying keybase user %s in federation address recipient: %s", name, data.Frozen.To)
				recipientAssertion = name
			}
		}
	} else if !isKeybaseAssertion(mctx, recipientAssertion) { // assume assertion resolution happened already.
		data.ReadyToSend = true
		wantFollowingCheck = false
	}

	mctx.Debug("wantFollowingCheck: %v", wantFollowingCheck)
	var stickyBanners []stellar1.SendBannerLocal
	if wantFollowingCheck {
		if isFollowing, err := isFollowingForReview(mctx, recipientAssertion); err == nil && !isFollowing {
			stickyBanners = []stellar1.SendBannerLocal{{
				Level:   "warning",
				Message: fmt.Sprintf("You are not following %v. Are you sure this is the right person?", recipientAssertion),
			}}
			notify(stickyBanners, reviewButtonSpinning)
		}
	}

	if !data.ReadyToSend {
		mctx.Debug("identifying recipient: %v", recipientAssertion)

		identifySuccessCh := make(chan struct{}, 1)
		identifyTrackFailCh := make(chan struct{}, 1)
		identifyErrCh := make(chan error, 1)

		// Forward notifications about successful identifies of this recipient.
		go func() {
			unsubscribe, globalSuccessCh := mctx.G().IdentifyDispatch.Subscribe(mctx)
			defer unsubscribe()
			for {
				select {
				case <-mctx.Ctx().Done():
					return
				case idRes := <-globalSuccessCh:
					if recipientUV.IsNil() || !idRes.Target.Equal(recipientUV.Uid) {
						continue
					}
					mctx.Debug("review forwarding identify success")
					select {
					case <-mctx.Ctx().Done():
						return
					case identifySuccessCh <- struct{}{}:
					}
				}
			}
		}()

		// Start an identify in the background.
		go identifyForReview(mctx, recipientAssertion,
			identifySuccessCh, identifyTrackFailCh, identifyErrCh)

	waiting:
		for {
			select {
			case <-mctx.Ctx().Done():
				return mctx.Ctx().Err()
			case <-identifyErrCh:
				stickyBanners = nil
				notify([]stellar1.SendBannerLocal{{
					Level:   "error",
					Message: fmt.Sprintf("Error while identifying %v. Please check your network and try again.", recipientAssertion),
				}}, reviewButtonDisabled)
			case <-identifyTrackFailCh:
				stickyBanners = nil
				notify([]stellar1.SendBannerLocal{{
					Level:         "error",
					Message:       fmt.Sprintf("Some of %v's proofs have changed since you last followed them.", recipientAssertion),
					ProofsChanged: true,
				}}, reviewButtonDisabled)
			case <-identifySuccessCh:
				data.ReadyToSend = true
				break waiting
			}
		}
	}

	if err := mctx.Ctx().Err(); err != nil {
		return err
	}
	receivedEnableCh := notify(stickyBanners, reviewButtonEnabled)

	// Stay open until this call gets canceled or until frontend
	// acks a notification that enables the button.
	select {
	case <-receivedEnableCh:
	case <-mctx.Ctx().Done():
	}
	return mctx.Ctx().Err()
}

// identifyForReview runs identify on a user, looking only for tracking breaks.
// Sends a value to exactly one of the three channels.
func identifyForReview(mctx libkb.MetaContext, assertion string,
	successCh chan<- struct{},
	trackFailCh chan<- struct{},
	errCh chan<- error) {
	// Goroutines that are blocked on otherwise unreachable channels are not GC'd.
	// So use ctx to clean up.
	sendSuccess := func() {
		mctx.Debug("identifyForReview(%v) -> success", assertion)
		select {
		case successCh <- struct{}{}:
		case <-mctx.Ctx().Done():
		}
	}
	sendTrackFail := func() {
		mctx.Debug("identifyForReview(%v) -> fail", assertion)
		select {
		case trackFailCh <- struct{}{}:
		case <-mctx.Ctx().Done():
		}
	}
	sendErr := func(err error) {
		mctx.Debug("identifyForReview(%v) -> err %v", assertion, err)
		select {
		case errCh <- err:
		case <-mctx.Ctx().Done():
		}
	}

	mctx.Debug("identifyForReview(%v)", assertion)
	reason := fmt.Sprintf("Identify transaction recipient: %s", assertion)
	eng := engine.NewResolveThenIdentify2(mctx.G(), &keybase1.Identify2Arg{
		UserAssertion:         assertion,
		CanSuppressUI:         true,
		NoErrorOnTrackFailure: true, // take heed
		Reason:                keybase1.IdentifyReason{Reason: reason},
		IdentifyBehavior:      keybase1.TLFIdentifyBehavior_RESOLVE_AND_CHECK,
	})
	err := engine.RunEngine2(mctx, eng)
	if err != nil {
		sendErr(err)
		return
	}
	idRes, err := eng.Result(mctx)
	if err != nil {
		sendErr(err)
		return
	}
	if idRes == nil {
		sendErr(fmt.Errorf("missing identify result"))
		return
	}
	mctx.Debug("identifyForReview: uv: %v", idRes.Upk.Current.ToUserVersion())
	if idRes.TrackBreaks != nil {
		sendTrackFail()
		return
	}
	sendSuccess()
}

// Whether the logged-in user following the recipient.
// Unresolved assertions will false negative.
func isFollowingForReview(mctx libkb.MetaContext, assertion string) (isFollowing bool, err error) {
	// The 'following' check blocks sending, and is not that important, so impose a timeout.
	var cancel func()
	mctx, cancel = mctx.WithTimeout(time.Second * 5)
	defer cancel()
	err = mctx.G().GetFullSelfer().WithSelf(mctx.Ctx(), func(u *libkb.User) error {
		idTable := u.IDTable()
		if idTable == nil {
			return nil
		}
		targetUsername := libkb.NewNormalizedUsername(assertion)
		for _, track := range idTable.GetTrackList() {
			if trackedUsername, err := track.GetTrackedUsername(); err == nil {
				if trackedUsername.Eq(targetUsername) {
					isFollowing = true
					return nil
				}
			}
		}
		return nil
	})
	return isFollowing, err
}

func isKeybaseAssertion(mctx libkb.MetaContext, assertion string) bool {
	expr, err := externals.AssertionParse(mctx, assertion)
	if err != nil {
		mctx.Debug("error parsing assertion: %s", err)
		return false
	}
	switch expr.(type) {
	case libkb.AssertionKeybase:
		return true
	case *libkb.AssertionKeybase:
		return true
	default:
		return false
	}
}

func BuildRequestLocal(mctx libkb.MetaContext, arg stellar1.BuildRequestLocalArg) (res stellar1.BuildRequestResLocal, err error) {
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "BuildRequestLocal", true)
	defer tracer.Finish()

	mctx = mctx.WithCtx(
		getGlobal(mctx.G()).buildPaymentSlot.Use(
			mctx.Ctx(), arg.SessionID))
	if err := mctx.Ctx().Err(); err != nil {
		return res, err
	}

	readyChecklist := struct {
		to         bool
		amount     bool
		secretNote bool
	}{}
	log := func(format string, args ...interface{}) {
		mctx.Debug("brl: "+format, args...)
	}

	bpc := getGlobal(mctx.G()).getBuildPaymentCache()
	if bpc == nil {
		return res, fmt.Errorf("missing build payment cache")
	}

	// -------------------- to --------------------

	tracer.Stage("to")
	skipRecipient := len(arg.To) == 0
	if !skipRecipient {
		_, err := bpc.LookupRecipient(mctx, stellarcommon.RecipientInput(arg.To))
		if err != nil {
			log("error with recipient field %v: %v", arg.To, err)
			res.ToErrMsg = "Recipient not found."
		} else {
			readyChecklist.to = true
		}
	}

	// -------------------- amount + asset --------------------

	tracer.Stage("amount + asset")
	bpaArg := buildPaymentAmountArg{
		Amount:   arg.Amount,
		Currency: arg.Currency,
		Asset:    arg.Asset,
	}

	// For requests From is always the primary account.
	primaryAccountID, err := bpc.PrimaryAccount(mctx)
	if err != nil {
		log("PrimaryAccount -> err:%v", err)
		res.Banners = append(res.Banners, stellar1.SendBannerLocal{
			Level:   "error",
			Message: fmt.Sprintf("Could not find primary account.%v", msgMore(err)),
		})
	} else {
		bpaArg.From = &primaryAccountID
	}

	amountX := buildPaymentAmountHelper(mctx, bpc, bpaArg)
	res.AmountErrMsg = amountX.amountErrMsg
	res.WorthDescription = amountX.worthDescription
	res.WorthInfo = amountX.worthInfo
	res.DisplayAmountXLM = amountX.displayAmountXLM
	res.DisplayAmountFiat = amountX.displayAmountFiat
	res.SendingIntentionXLM = amountX.sendingIntentionXLM
	readyChecklist.amount = amountX.haveAmount

	// -------------------- note --------------------

	tracer.Stage("note")
	if len(arg.SecretNote) <= libkb.MaxStellarPaymentNoteLength {
		readyChecklist.secretNote = true
	} else {
		res.SecretNoteErrMsg = "Note is too long."
	}

	// -------------------- end --------------------

	if readyChecklist.to && readyChecklist.amount && readyChecklist.secretNote {
		res.ReadyToRequest = true
	}
	// Return the context's error.
	// If just `nil` were returned then in the event of a cancellation
	// resilient parts of this function could hide it, causing
	// a bogus return value.
	return res, mctx.Ctx().Err()
}

type buildPaymentAmountArg struct {
	// See buildPaymentLocal in avdl from which these args are copied.
	Bid      stellar1.BuildPaymentID
	Amount   string
	Currency *stellar1.OutsideCurrencyCode
	Asset    *stellar1.Asset
	From     *stellar1.AccountID
}

type buildPaymentAmountResult struct {
	haveAmount       bool // whether `amountOfAsset` and `asset` are valid
	amountOfAsset    string
	asset            stellar1.Asset
	amountErrMsg     string
	worthDescription string
	worthInfo        string
	worthCurrency    string
	// Rate may be nil if there was an error fetching it.
	rate                *stellar1.OutsideExchangeRate
	displayAmountXLM    string
	displayAmountFiat   string
	sendingIntentionXLM bool
}

var zeroOrNoAmountRE = regexp.MustCompile(`^0*\.?0*$`)

func buildPaymentAmountHelper(mctx libkb.MetaContext, bpc BuildPaymentCache, arg buildPaymentAmountArg) (res buildPaymentAmountResult) {
	log := func(format string, args ...interface{}) {
		mctx.Debug("bpl: "+format, args...)
	}
	res.asset = stellar1.AssetNative()
	switch {
	case arg.Currency != nil && arg.Asset == nil:
		// Amount is of outside currency.
		res.sendingIntentionXLM = false
		convertAmountOutside := "0"

		if zeroOrNoAmountRE.MatchString(arg.Amount) {
			// Zero or no amount given. Still convert for 0.
		} else {
			amount, err := stellarnet.ParseAmount(arg.Amount)
			if err != nil || amount.Sign() < 0 {
				// Invalid or negative amount.
				res.amountErrMsg = "Invalid amount."
				return res
			}
			if amount.Sign() > 0 {
				// Only save the amount if it's non-zero. So that =="0" later works.
				convertAmountOutside = arg.Amount
			}
		}
		xrate, err := bpc.GetOutsideExchangeRate(mctx, *arg.Currency)
		if err != nil {
			log("error getting exchange rate for %v: %v", arg.Currency, err)
			res.amountErrMsg = fmt.Sprintf("Could not get exchange rate for %v", arg.Currency.String())
			return res
		}
		res.rate = &xrate
		xlmAmount, err := stellarnet.ConvertOutsideToXLM(convertAmountOutside, xrate.Rate)
		if err != nil {
			log("error converting: %v", err)
			res.amountErrMsg = fmt.Sprintf("Could not convert to XLM")
			return res
		}
		res.amountOfAsset = xlmAmount
		xlmAmountFormatted, err := FormatAmountDescriptionXLM(mctx, xlmAmount)
		if err != nil {
			log("error formatting converted XLM amount: %v", err)
			res.amountErrMsg = fmt.Sprintf("Could not convert to XLM")
			return res
		}
		res.worthDescription = xlmAmountFormatted
		res.worthCurrency = string(*arg.Currency)
		if convertAmountOutside != "0" {
			// haveAmount gates whether the send button is enabled.
			// Only enable after `worthDescription` is set.
			// Don't allow the user to send if they haven't seen `worthDescription`,
			// since that's what they are really sending.
			res.haveAmount = true
		}
		res.worthInfo, err = buildPaymentWorthInfo(mctx, xrate)
		if err != nil {
			log("error making worth info: %v", err)
			res.worthInfo = ""
		}

		res.displayAmountXLM = xlmAmountFormatted
		res.displayAmountFiat, err = FormatCurrencyWithCodeSuffix(mctx, convertAmountOutside, *arg.Currency, stellarnet.Round)
		if err != nil {
			log("error converting for displayAmountFiat: %q / %q : %s", convertAmountOutside, arg.Currency, err)
			res.displayAmountFiat = ""
		}

		return res
	case arg.Currency == nil:
		res.sendingIntentionXLM = true
		if arg.Asset != nil {
			res.asset = *arg.Asset
		}
		// Amount is of asset.
		useAmount := "0"
		if zeroOrNoAmountRE.MatchString(arg.Amount) {
			// Zero or no amount given.
		} else {
			amountInt64, err := stellarnet.ParseStellarAmount(arg.Amount)
			if err != nil || amountInt64 <= 0 {
				res.amountErrMsg = "Invalid amount."
				return res
			}
			res.amountOfAsset = arg.Amount
			res.haveAmount = true
			useAmount = arg.Amount
		}
		if !res.asset.IsNativeXLM() {
			res.sendingIntentionXLM = false
			// If sending non-XLM asset, don't try to show a worth.
			return res
		}
		// Attempt to show the converted amount in outside currency.
		// Unlike when sending based on outside currency, conversion is not critical.
		if arg.From == nil {
			log("missing from address so can't convert XLM amount")
			return res
		}
		currency, err := bpc.GetOutsideCurrencyPreference(mctx, *arg.From, arg.Bid)
		if err != nil {
			log("error getting preferred currency for %v: %v", *arg.From, err)
			return res
		}
		xrate, err := bpc.GetOutsideExchangeRate(mctx, currency)
		if err != nil {
			log("error getting exchange rate for %v: %v", currency, err)
			return res
		}
		res.rate = &xrate
		outsideAmount, err := stellarnet.ConvertXLMToOutside(useAmount, xrate.Rate)
		if err != nil {
			log("error converting: %v", err)
			return res
		}
		outsideAmountFormatted, err := FormatCurrencyWithCodeSuffix(mctx, outsideAmount, xrate.Currency, stellarnet.Round)
		if err != nil {
			log("error formatting converted outside amount: %v", err)
			return res
		}
		res.worthDescription = outsideAmountFormatted
		res.worthCurrency = string(currency)
		res.worthInfo, err = buildPaymentWorthInfo(mctx, xrate)
		if err != nil {
			log("error making worth info: %v", err)
			res.worthInfo = ""
		}

		if arg.Amount != "" {
			res.displayAmountXLM, err = FormatAmountDescriptionXLM(mctx, arg.Amount)
			if err != nil {
				log("error formatting xlm %q: %s", arg.Amount, err)
				res.displayAmountXLM = ""
			}
			res.displayAmountFiat, err = FormatCurrencyWithCodeSuffix(mctx, outsideAmount, xrate.Currency, stellarnet.Round)
			if err != nil {
				log("error formatting fiat %q / %v: %s", outsideAmount, xrate.Currency, err)
				res.displayAmountFiat = ""
			}
		}

		return res
	default:
		// This is an API contract problem.
		mctx.Warning("Only one of Asset and Currency parameters should be filled")
		res.amountErrMsg = "Error in communication"
		return res
	}
}

func buildPaymentWorthInfo(mctx libkb.MetaContext, rate stellar1.OutsideExchangeRate) (worthInfo string, err error) {
	oneOutsideFormatted, err := FormatCurrency(mctx, "1", rate.Currency, stellarnet.Round)
	if err != nil {
		return "", err
	}
	amountXLM, err := stellarnet.ConvertOutsideToXLM("1", rate.Rate)
	if err != nil {
		return "", err
	}
	amountXLMFormatted, err := FormatAmountDescriptionXLM(mctx, amountXLM)
	if err != nil {
		return "", err
	}
	worthInfo = fmt.Sprintf("%s = %s\nSource: coinmarketcap.com", oneOutsideFormatted, amountXLMFormatted)
	return worthInfo, nil
}

// Subtract baseFee from the available balance.
// This shows the real available balance assuming an intent to send a 1 op tx.
// Does not error out, just shows the inaccurate answer.
func SubtractFeeSoft(mctx libkb.MetaContext, availableStr string, baseFee uint64) string {
	available, err := stellarnet.ParseStellarAmount(availableStr)
	if err != nil {
		mctx.Debug("error parsing available balance: %v", err)
		return availableStr
	}
	available -= int64(baseFee)
	if available < 0 {
		available = 0
	}
	return stellarnet.StringFromStellarAmount(available)
}

// Record of an in-progress payment build.
type buildPaymentEntry struct {
	Bid     stellar1.BuildPaymentID
	Stopped bool
	// The processs in Slot likely holds DataLock and pointer to Data.
	Slot     *slotctx.PrioritySlot // Only one build or review call at a time.
	DataLock sync.Mutex
	Data     buildPaymentData
}

type buildPaymentData struct {
	ReadyToReview bool
	ReadyToSend   bool
	Frozen        *frozenPayment // Latest form values.
}

type frozenPayment struct {
	From          stellar1.AccountID
	To            string
	ToUV          keybase1.UserVersion
	ToIsAccountID bool
	Amount        string
	Asset         stellar1.Asset
	// SecretNote and PublicMemo are not checked because
	// frontend may not call build when the user changes the notes.
}

func newBuildPaymentEntry(bid stellar1.BuildPaymentID) *buildPaymentEntry {
	return &buildPaymentEntry{
		Bid:  bid,
		Slot: slotctx.NewPriority(),
		Data: buildPaymentData{
			ReadyToReview: false,
			ReadyToSend:   false,
		},
	}
}

// Ready decides whether the frozen payment has been prechecked and
// the Send request matches it.
func (b *buildPaymentData) CheckReadyToSend(arg stellar1.SendPaymentLocalArg) error {
	if !b.ReadyToSend {
		if !b.ReadyToReview {
			// Payment is not even ready for review.
			return fmt.Errorf("this payment is not ready to send")
		}
		// Payment is ready to review but has not been reviewed.
		return fmt.Errorf("this payment has not been reviewed")
	}
	if b.Frozen == nil {
		return fmt.Errorf("payment is ready to send but missing frozen values")
	}
	if !arg.From.Eq(b.Frozen.From) {
		return fmt.Errorf("mismatched from account: %v != %v", arg.From, b.Frozen.From)
	}
	if arg.To != b.Frozen.To {
		return fmt.Errorf("mismatched recipient: %v != %v", arg.To, b.Frozen.To)
	}
	if arg.ToIsAccountID != b.Frozen.ToIsAccountID {
		return fmt.Errorf("mismatches account ID type (expected %v)", b.Frozen.ToIsAccountID)
	}
	// Check the true amount and asset that will be sent.
	// Don't bother checking the display worth. It's finicky and the server does a coarse check.
	if arg.Amount != b.Frozen.Amount {
		return fmt.Errorf("mismatched amount: %v != %v", arg.Amount, b.Frozen.Amount)
	}
	if !arg.Asset.SameAsset(b.Frozen.Asset) {
		return fmt.Errorf("mismatched asset: %v != %v", arg.Asset, b.Frozen.Asset)
	}
	return nil
}

func msgMore(err error) string {
	switch err.(type) {
	case libkb.APINetError, *libkb.APINetError:
		return " Please check your network and try again."
	default:
		return ""
	}
}
