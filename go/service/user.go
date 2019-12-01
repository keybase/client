// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/keybase/client/go/uidmap"

	"github.com/keybase/client/go/avatars"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/offline"
	"github.com/keybase/client/go/phonenumbers"
	"github.com/keybase/client/go/profiling"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// UserHandler is the RPC handler for the user interface.
type UserHandler struct {
	*BaseHandler
	libkb.Contextified
	globals.ChatContextified
	service *Service
}

// NewUserHandler creates a UserHandler for the xp transport.
func NewUserHandler(xp rpc.Transporter, g *libkb.GlobalContext, chatG *globals.ChatContext, s *Service) *UserHandler {
	return &UserHandler{
		BaseHandler:      NewBaseHandler(g, xp),
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(chatG),
		service:          s,
	}
}

func (h *UserHandler) LoadUncheckedUserSummaries(ctx context.Context, arg keybase1.LoadUncheckedUserSummariesArg) ([]keybase1.UserSummary, error) {
	eng := engine.NewUserSummary(h.G(), arg.Uids)
	m := libkb.NewMetaContext(ctx, h.G())
	if err := engine.RunEngine2(m, eng); err != nil {
		return nil, err
	}
	res := eng.ExportedSummariesList()
	return res, nil
}

func (h *UserHandler) ListTracking(ctx context.Context, arg keybase1.ListTrackingArg) (res []keybase1.UserSummary, err error) {
	eng := engine.NewListTrackingEngine(h.G(), &engine.ListTrackingEngineArg{
		Filter:       arg.Filter,
		ForAssertion: arg.Assertion,
		// Verbose has no effect on this call. At the engine level, it only
		// affects JSON output.
	})
	m := libkb.NewMetaContext(ctx, h.G())
	err = engine.RunEngine2(m, eng)
	res = eng.TableResult()
	return
}

func (h *UserHandler) ListTrackingJSON(ctx context.Context, arg keybase1.ListTrackingJSONArg) (res string, err error) {
	eng := engine.NewListTrackingEngine(h.G(), &engine.ListTrackingEngineArg{
		JSON:         true,
		Filter:       arg.Filter,
		Verbose:      arg.Verbose,
		ForAssertion: arg.Assertion,
	})
	m := libkb.NewMetaContext(ctx, h.G())
	err = engine.RunEngine2(m, eng)
	res = eng.JSONResult()
	return
}

func (h *UserHandler) LoadUser(ctx context.Context, arg keybase1.LoadUserArg) (user keybase1.User, err error) {
	loadUserArg := libkb.NewLoadUserByUIDArg(ctx, h.G(), arg.Uid).WithPublicKeyOptional()
	u, err := libkb.LoadUser(loadUserArg)
	if err != nil {
		return
	}
	exportedUser := u.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) LoadUserByName(_ context.Context, arg keybase1.LoadUserByNameArg) (user keybase1.User, err error) {
	loadUserArg := libkb.NewLoadUserByNameArg(h.G(), arg.Username).WithPublicKeyOptional()
	u, err := libkb.LoadUser(loadUserArg)
	if err != nil {
		return
	}
	exportedUser := u.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) LoadUserPlusKeysV2(ctx context.Context, arg keybase1.LoadUserPlusKeysV2Arg) (ret keybase1.UserPlusKeysV2AllIncarnations, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LUPK2")
	defer mctx.Trace(fmt.Sprintf("UserHandler#LoadUserPlusKeysV2(%+v)", arg), func() error { return err })()

	cacheArg := keybase1.LoadUserPlusKeysV2Arg{
		Uid: arg.Uid,
	}

	retp := &ret
	servedRet, err := h.service.offlineRPCCache.Serve(mctx, arg.Oa, offline.Version(1), "user.loadUserPlusKeysV2", false, cacheArg, &retp, func(mctx libkb.MetaContext) (interface{}, error) {
		return h.G().GetUPAKLoader().LoadV2WithKID(mctx.Ctx(), arg.Uid, arg.PollForKID)
	})
	if s, ok := servedRet.(*keybase1.UserPlusKeysV2AllIncarnations); ok && s != nil {
		// Even if err != nil, the caller might still be expecting
		// data, so use the return value if there is one.
		ret = *s
	} else if err != nil {
		ret = keybase1.UserPlusKeysV2AllIncarnations{}
	}
	return ret, err
}

func (h *UserHandler) LoadUserPlusKeys(netCtx context.Context, arg keybase1.LoadUserPlusKeysArg) (keybase1.UserPlusKeys, error) {
	netCtx = libkb.WithLogTag(netCtx, "LUPK")
	h.G().Log.CDebugf(netCtx, "+ UserHandler#LoadUserPlusKeys(%+v)", arg)
	ret, err := libkb.LoadUserPlusKeys(netCtx, h.G(), arg.Uid, arg.PollForKID)

	// for debugging purposes, output the returned KIDs (since this can be racy)
	var kids []keybase1.KID
	for _, key := range ret.DeviceKeys {
		if !key.IsSibkey && key.PGPFingerprint == "" {
			kids = append(kids, key.KID)
		}
	}

	if err == nil {
		// ret.Status might indicate an error we should return
		// (like libkb.UserDeletedError, for example)
		err = libkb.UserErrorFromStatus(ret.Status)
		if err != nil {
			h.G().Log.CDebugf(netCtx, "using error from StatusCode: %v => %s", ret.Status, err)
		}
	}

	h.G().Log.CDebugf(netCtx, "- UserHandler#LoadUserPlusKeys(%+v) -> (UVV=%+v, KIDs=%v, err=%s)", arg, ret.Uvv, kids, libkb.ErrToOk(err))
	return ret, err
}

func (h *UserHandler) LoadMySettings(ctx context.Context, sessionID int) (res keybase1.UserSettings, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	emails, err := libkb.LoadUserEmails(mctx)
	if err != nil {
		return res, err
	}
	phoneNumbers, err := phonenumbers.GetPhoneNumbers(mctx)
	if err != nil {
		switch err.(type) {
		case libkb.FeatureFlagError:
			mctx.Debug("PhoneNumbers feature not enabled - phone number list will be empty")
		default:
			return res, err
		}
	}
	res.Emails = emails
	res.PhoneNumbers = phoneNumbers
	return res, nil
}

func (h *UserHandler) LoadPublicKeys(ctx context.Context, arg keybase1.LoadPublicKeysArg) (keys []keybase1.PublicKey, err error) {
	larg := libkb.NewLoadUserArg(h.G()).WithUID(arg.Uid)
	return h.loadPublicKeys(ctx, larg)
}

func (h *UserHandler) LoadMyPublicKeys(ctx context.Context, sessionID int) (keys []keybase1.PublicKey, err error) {
	larg := libkb.NewLoadUserArg(h.G()).WithSelf(true)
	return h.loadPublicKeys(ctx, larg)
}

func (h *UserHandler) loadPublicKeys(ctx context.Context, larg libkb.LoadUserArg) (keys []keybase1.PublicKey, err error) {
	u, err := libkb.LoadUser(larg)
	if err != nil {
		return
	}
	var publicKeys []keybase1.PublicKey
	if u.GetComputedKeyFamily() != nil {
		publicKeys = u.GetComputedKeyFamily().Export()
	}
	return publicKeys, nil
}

func (h *UserHandler) LoadAllPublicKeysUnverified(ctx context.Context,
	arg keybase1.LoadAllPublicKeysUnverifiedArg) (keys []keybase1.PublicKey, err error) {

	u, err := libkb.LoadUserFromServer(libkb.NewMetaContext(ctx, h.G()), arg.Uid, nil)
	if err != nil {
		return
	}
	var publicKeys []keybase1.PublicKey
	if u.GetKeyFamily() != nil {
		publicKeys = u.GetKeyFamily().Export()
	}
	return publicKeys, nil
}

func (h *UserHandler) ListTrackers2(ctx context.Context, arg keybase1.ListTrackers2Arg) (res keybase1.UserSummary2Set, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	defer m.Trace(fmt.Sprintf("ListTrackers2(assertion=%s,reverse=%v)", arg.Assertion, arg.Reverse),
		func() error { return err })()
	eng := engine.NewListTrackers2(h.G(), arg)
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	m = m.WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	if err == nil {
		res = eng.GetResults()
	}
	return res, err
}

func (h *UserHandler) ProfileEdit(nctx context.Context, arg keybase1.ProfileEditArg) error {
	eng := engine.NewProfileEdit(h.G(), arg)
	m := libkb.NewMetaContext(nctx, h.G())
	return engine.RunEngine2(m, eng)
}

func (h *UserHandler) InterestingPeople(ctx context.Context, maxUsers int) (res []keybase1.InterestingPerson, err error) {
	// In case someone comes from "GetInterestingPeople" command in standalone
	// mode:
	h.G().StartStandaloneChat()

	// Chat source
	chatFn := func(uid keybase1.UID) (kuids []keybase1.UID, err error) {
		g := globals.NewContext(h.G(), h.ChatG())
		list, err := chat.RecentConversationParticipants(ctx, g, uid.ToBytes())
		if err != nil {
			return nil, err
		}
		for _, guid := range list {
			kuids = append(kuids, keybase1.UID(guid.String()))
		}
		return kuids, nil
	}

	// Follower source
	followerFn := func(uid keybase1.UID) (res []keybase1.UID, err error) {
		var found bool
		var tmp keybase1.UserSummary2Set
		found, err = h.G().LocalDb.GetInto(&tmp, libkb.DbKeyUID(libkb.DBTrackers2Reverse, uid))
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, nil
		}
		for _, u := range tmp.Users {
			res = append(res, u.Uid)
		}
		return res, nil
	}

	fallbackFn := func(uid keybase1.UID) (uids []keybase1.UID, err error) {
		uids = []keybase1.UID{
			libkb.GetUIDByNormalizedUsername(h.G(), "hellobot"),
			h.G().GetEnv().GetUID(),
		}

		return uids, nil
	}

	ip := newInterestingPeople(h.G())

	// Add sources of interesting people
	ip.AddSource(chatFn, 0.7)
	ip.AddSource(followerFn, 0.2)
	ip.AddSource(fallbackFn, 0.1)

	uids, err := ip.Get(ctx, maxUsers)
	if err != nil {
		h.G().Log.Debug("InterestingPeople: failed to get list: %s", err.Error())
		return nil, err
	}

	if len(uids) == 0 {
		h.G().Log.Debug("InterestingPeople: there are no interesting people for current user")
		return []keybase1.InterestingPerson{}, nil
	}

	const fullnameFreshness = 0 // never stale
	packages, err := h.G().UIDMapper.MapUIDsToUsernamePackagesOffline(ctx, h.G(), uids, fullnameFreshness)
	if err != nil {
		h.G().Log.Debug("InterestingPeople: failed in UIDMapper: %s, but continuing", err.Error())
	}

	const serviceMapFreshness = 24 * time.Hour
	serviceMaps := h.G().ServiceMapper.MapUIDsToServiceSummaries(ctx, h.G(), uids,
		serviceMapFreshness, uidmap.DisallowNetworkBudget)

	for i, uid := range uids {
		if packages[i].NormalizedUsername.IsNil() {
			// We asked UIDMapper for cached data only, this username was missing.
			h.G().Log.Debug("InterestingPeople: failed to get username for: %s", uid)
			continue
		}
		ret := keybase1.InterestingPerson{
			Uid:      uid,
			Username: packages[i].NormalizedUsername.String(),
		}
		if fn := packages[i].FullName; fn != nil {
			ret.Fullname = fn.FullName.String()
		}
		if smap, found := serviceMaps[uid]; found {
			ret.ServiceMap = smap.ServiceMap
		}
		res = append(res, ret)
	}
	return res, nil
}

func (h *UserHandler) MeUserVersion(ctx context.Context, arg keybase1.MeUserVersionArg) (res keybase1.UserVersion, err error) {
	loadMeArg := libkb.NewLoadUserArg(h.G()).
		WithNetContext(ctx).
		WithUID(h.G().Env.GetUID()).
		WithSelf(true).
		WithForcePoll(arg.ForcePoll).
		WithPublicKeyOptional()
	upak, _, err := h.G().GetUPAKLoader().LoadV2(loadMeArg)
	if err != nil {
		return keybase1.UserVersion{}, err
	}
	if upak == nil {
		return keybase1.UserVersion{}, fmt.Errorf("could not load self upak")
	}
	return upak.Current.ToUserVersion(), nil
}

func (h *UserHandler) GetUPAK(ctx context.Context, uid keybase1.UID) (ret keybase1.UPAKVersioned, err error) {
	arg := libkb.NewLoadUserArg(h.G()).WithNetContext(ctx).WithUID(uid).WithPublicKeyOptional()
	upak, _, err := h.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return ret, err
	}
	if upak == nil {
		return ret, libkb.UserNotFoundError{UID: uid, Msg: "upak load failed"}
	}
	ret = keybase1.NewUPAKVersionedWithV2(*upak)
	return ret, err
}

func (h *UserHandler) GetUPAKLite(ctx context.Context, uid keybase1.UID) (ret keybase1.UPKLiteV1AllIncarnations, err error) {
	arg := libkb.NewLoadUserArg(h.G()).WithNetContext(ctx).WithUID(uid).WithPublicKeyOptional().ForUPAKLite()
	upakLite, err := h.G().GetUPAKLoader().LoadLite(arg)
	if err != nil {
		return ret, err
	}
	if upakLite == nil {
		return ret, libkb.UserNotFoundError{UID: uid, Msg: "upak load failed"}
	}
	ret = *upakLite
	return ret, nil
}

func (h *UserHandler) UploadUserAvatar(ctx context.Context, arg keybase1.UploadUserAvatarArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "US")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("UploadUserAvatar(%s)", arg.Filename), func() error { return err })()

	mctx := libkb.NewMetaContext(ctx, h.G())
	return avatars.UploadImage(mctx, arg.Filename, nil /* teamname */, arg.Crop)
}

func (h *UserHandler) ProofSuggestions(ctx context.Context, sessionID int) (ret keybase1.ProofSuggestionsRes, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("US")
	defer mctx.TraceTimed("ProofSuggestions", func() error { return err })()
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "ProofSuggestions", libkb.ProfileProofSuggestions)
	defer tracer.Finish()
	suggestions, err := h.proofSuggestionsHelper(mctx, tracer)
	if err != nil {
		return ret, err
	}
	tracer.Stage("fold-pri")
	foldPriority := mctx.G().GetProofServices().SuggestionFoldPriority(h.MetaContext(ctx))
	tracer.Stage("fold-loop")
	for _, suggestion := range suggestions {
		if foldPriority > 0 && suggestion.Priority >= foldPriority {
			ret.ShowMore = true
			suggestion.BelowFold = true
		}
		ret.Suggestions = append(ret.Suggestions, suggestion.ProofSuggestion)
	}
	return ret, nil
}

type ProofSuggestion struct {
	keybase1.ProofSuggestion
	LogoKey  string
	Priority int
}

var pgpProofSuggestion = ProofSuggestion{
	ProofSuggestion: keybase1.ProofSuggestion{
		Key:           "pgp",
		ProfileText:   "Add a PGP key",
		PickerText:    "PGP key",
		PickerSubtext: "",
	},
	LogoKey: "pgp",
}

var webProofSuggestion = ProofSuggestion{
	ProofSuggestion: keybase1.ProofSuggestion{
		Key:           "web",
		ProfileText:   "Prove your website",
		PickerText:    "Your own website",
		PickerSubtext: "",
	},
	LogoKey: "web",
}

var bitcoinProofSuggestion = ProofSuggestion{
	ProofSuggestion: keybase1.ProofSuggestion{
		Key:           "btc",
		ProfileText:   "Set a Bitcoin address",
		PickerText:    "Bitcoin address",
		PickerSubtext: "",
	},
	LogoKey: "btc",
}

var zcashProofSuggestion = ProofSuggestion{
	ProofSuggestion: keybase1.ProofSuggestion{
		Key:           "zcash",
		ProfileText:   "Set a Zcash address",
		PickerText:    "Zcash address",
		PickerSubtext: "",
	},
	LogoKey: "zcash",
}

func (h *UserHandler) proofSuggestionsHelper(mctx libkb.MetaContext, tracer profiling.TimeTracer) (ret []ProofSuggestion, err error) {
	user, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(mctx).WithPublicKeyOptional())
	if err != nil {
		return ret, err
	}
	if user == nil || user.IDTable() == nil {
		return ret, fmt.Errorf("could not load logged-in user")
	}

	tracer.Stage("get_list")
	var suggestions []ProofSuggestion
	serviceKeys := mctx.G().GetProofServices().ListServicesThatAcceptNewProofs(mctx)
	tracer.Stage("loop_keys")
	for _, service := range serviceKeys {
		switch service {
		case "web", "dns", "http", "https":
			// These are under the "web" umbrella.
			// "web" is added below.
			continue
		}
		serviceType := mctx.G().GetProofServices().GetServiceType(mctx.Ctx(), service)
		if serviceType == nil {
			mctx.Debug("missing proof service type: %v", service)
			continue
		}
		if len(user.IDTable().GetActiveProofsFor(serviceType)) > 0 {
			mctx.Debug("user has an active proof: %v", serviceType.Key())
			continue
		}
		subtext := serviceType.DisplayGroup()
		if len(subtext) == 0 {
			subtext = serviceType.PickerSubtext()
		}
		var metas []keybase1.Identify3RowMeta
		if serviceType.IsNew(mctx) {
			metas = []keybase1.Identify3RowMeta{{Label: "new", Color: keybase1.Identify3RowColor_BLUE}}
		}
		suggestions = append(suggestions, ProofSuggestion{
			LogoKey: serviceType.GetLogoKey(),
			ProofSuggestion: keybase1.ProofSuggestion{
				Key:           service,
				ProfileText:   fmt.Sprintf("Prove your %v", serviceType.DisplayName()),
				PickerText:    serviceType.DisplayName(),
				PickerSubtext: subtext,
				Metas:         metas,
			}})
	}
	tracer.Stage("misc")
	hasPGP := len(user.GetActivePGPKeys(true)) > 0
	if !hasPGP {
		suggestions = append(suggestions, pgpProofSuggestion)
	}
	// Always show the option to create a new web proof.
	suggestions = append(suggestions, webProofSuggestion)
	if !user.IDTable().HasActiveCryptocurrencyFamily(libkb.CryptocurrencyFamilyBitcoin) {
		suggestions = append(suggestions, bitcoinProofSuggestion)
	}
	if !user.IDTable().HasActiveCryptocurrencyFamily(libkb.CryptocurrencyFamilyZCash) {
		suggestions = append(suggestions, zcashProofSuggestion)
	}

	// Attach icon urls
	tracer.Stage("icons")
	for i := range suggestions {
		suggestion := &suggestions[i]
		suggestion.ProfileIcon = externals.MakeIcons(mctx, suggestion.LogoKey, "logo_black", 16)
		suggestion.ProfileIconWhite = externals.MakeIcons(mctx, suggestion.LogoKey, "logo_white", 16)
		suggestion.PickerIcon = externals.MakeIcons(mctx, suggestion.LogoKey, "logo_full", 32)
	}

	// Alphabetize so that ties later on in SliceStable are deterministic.
	tracer.Stage("alphabetize")
	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].Key < suggestions[j].Key
	})

	// Priorities from the server.
	tracer.Stage("prioritize-server")
	serverPriority := make(map[string]int) // key -> server priority
	maxServerPriority := 0
	for _, displayConfig := range mctx.G().GetProofServices().ListDisplayConfigs(mctx) {
		if displayConfig.Priority <= 0 {
			continue
		}
		var altKey string
		switch displayConfig.Key {
		case "zcash.t", "zcash.z", "zcash.s":
			altKey = "zcash"
		case "bitcoin":
			altKey = "btc"
		case "http", "https", "dns":
			altKey = "web"
		}
		serverPriority[displayConfig.Key] = displayConfig.Priority
		if len(altKey) > 0 {
			if v, ok := serverPriority[altKey]; !ok || displayConfig.Priority < v {
				serverPriority[altKey] = displayConfig.Priority
			}
		}
		if displayConfig.Priority > maxServerPriority {
			maxServerPriority = displayConfig.Priority
		}
	}

	// Fallback priorities for rows the server missed.
	// Fallback priorities are placed after server priorities.
	tracer.Stage("fallback")
	offlineOrder := []string{
		"twitter",
		"github",
		"reddit",
		"hackernews",
		"rooter",
		"web",
		"pgp",
		"bitcoin",
		"zcash",
	}
	offlineOrderMap := make(map[string]int) // key -> offline priority
	for i, k := range offlineOrder {
		offlineOrderMap[k] = i
	}

	tracer.Stage("prioritize-again")
	priorityFn := func(key string) int {
		if p, ok := serverPriority[key]; ok {
			return p
		} else if p, ok := offlineOrderMap[key]; ok {
			return p + maxServerPriority + 1
		} else {
			return len(offlineOrderMap) + maxServerPriority
		}
	}
	for i := range suggestions {
		suggestions[i].Priority = priorityFn(suggestions[i].Key)
	}

	tracer.Stage("sort-final")
	sort.SliceStable(suggestions, func(i, j int) bool {
		return suggestions[i].Priority < suggestions[j].Priority
	})
	return suggestions, nil
}

func (h *UserHandler) FindNextMerkleRootAfterRevoke(ctx context.Context, arg keybase1.FindNextMerkleRootAfterRevokeArg) (ret keybase1.NextMerkleRootRes, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	m = m.WithLogTag("FNMR")
	defer m.TraceTimed("UserHandler#FindNextMerkleRootAfterRevoke", func() error { return err })()
	return libkb.FindNextMerkleRootAfterRevoke(m, arg)
}

func (h *UserHandler) FindNextMerkleRootAfterReset(ctx context.Context, arg keybase1.FindNextMerkleRootAfterResetArg) (ret keybase1.NextMerkleRootRes, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	m = m.WithLogTag("FNMR")
	defer m.TraceTimed("UserHandler#FindNextMerkleRootAfterReset", func() error { return err })()
	return libkb.FindNextMerkleRootAfterReset(m, arg)
}

func (h *UserHandler) LoadPassphraseState(ctx context.Context, sessionID int) (res keybase1.PassphraseState, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	return libkb.LoadPassphraseStateWithForceRepoll(m)
}

func (h *UserHandler) CanLogout(ctx context.Context, sessionID int) (res keybase1.CanLogoutRes, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	res = libkb.CanLogout(m)
	return res, nil
}

func (h *UserHandler) UserCard(ctx context.Context, arg keybase1.UserCardArg) (res *keybase1.UserCard, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("UserHandler#UserCard", func() error { return err })()

	uid := libkb.GetUIDByUsername(h.G(), arg.Username)
	if res, err = libkb.UserCard(mctx, uid, arg.UseSession); err != nil {
		return res, err
	}
	// decorate body for use in chat
	if res != nil {
		res.BioDecorated = utils.PresentDecoratedUserBio(ctx, res.Bio)
	}
	return res, nil
}

func (h *UserHandler) SetUserBlocks(ctx context.Context, arg keybase1.SetUserBlocksArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed(
		fmt.Sprintf("UserHandler#SetUserBlocks(len=%d)", len(arg.Blocks)),
		func() error { return err })()

	type setBlockArg struct {
		BlockUID string `json:"block_uid"`
		Chat     *bool  `json:"chat,omitempty"`
		Follow   *bool  `json:"follow,omitempty"`
	}

	payloadBlocks := make([]setBlockArg, len(arg.Blocks))
	for i, v := range arg.Blocks {
		uid := libkb.GetUIDByUsername(h.G(), v.Username)
		payloadBlocks[i] = setBlockArg{
			BlockUID: uid.String(),
			Chat:     v.SetChatBlock,
			Follow:   v.SetFollowBlock,
		}
	}

	payload := make(libkb.JSONPayload)
	payload["blocks"] = payloadBlocks

	apiArg := libkb.APIArg{
		Endpoint:    "user/set_blocks",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err = mctx.G().API.Post(mctx, apiArg)
	return err

}

func (h *UserHandler) GetUserBlocks(ctx context.Context, arg keybase1.GetUserBlocksArg) (res []keybase1.UserBlock, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())

	var usernameLog string
	if len(arg.Usernames) < 5 {
		usernameLog = strings.Join(arg.Usernames, ",")
	} else {
		usernameLog = fmt.Sprintf("%s... %d total", strings.Join(arg.Usernames[:5], ","), len(arg.Usernames))
	}
	defer mctx.TraceTimed(
		fmt.Sprintf("UserHandler#GetUserBlocks(%s)", usernameLog),
		func() error { return err })()

	httpArgs := libkb.HTTPArgs{}
	if len(arg.Usernames) > 0 {
		uids := make([]keybase1.UID, len(arg.Usernames))
		for i, v := range arg.Usernames {
			uids[i] = libkb.GetUIDByUsername(h.G(), v)
		}
		httpArgs["uids"] = libkb.S{Val: libkb.UidsToString(uids)}
	}

	apiArg := libkb.APIArg{
		Endpoint:    "user/get_blocks",
		Args:        httpArgs,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	type getBlockResult struct {
		libkb.AppStatusEmbed
		Blocks []struct {
			BlockUID      keybase1.UID   `json:"block_uid"`
			BlockUsername string         `json:"block_username"`
			CTime         *keybase1.Time `json:"ctime,omitempty"`
			MTime         *keybase1.Time `json:"mtime,omitempty"`
			Chat          bool           `json:"chat"`
			Follow        bool           `json:"follow"`
		} `json:"blocks"`
	}

	var apiRes getBlockResult

	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return nil, err
	}

	res = make([]keybase1.UserBlock, len(apiRes.Blocks))
	for i, v := range apiRes.Blocks {
		if err := libkb.AssertUsernameMatchesUID(h.G(), v.BlockUID, v.BlockUsername); err != nil {
			return nil, err
		}
		res[i] = keybase1.UserBlock{
			Username:      v.BlockUsername,
			ChatBlocked:   v.Chat,
			FollowBlocked: v.Follow,
			CreateTime:    v.CTime,
			ModifyTime:    v.MTime,
		}
	}

	return res, nil
}

func (h *UserHandler) ReportUser(ctx context.Context, arg keybase1.ReportUserArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	convIDStr := "nil"
	if arg.ConvID != nil {
		convIDStr = *arg.ConvID
	}
	defer mctx.TraceTimed(fmt.Sprintf(
		"UserHandler#ReportUser(username=%q,transcript=%t,convId=%s)",
		arg.Username, arg.IncludeTranscript, convIDStr),
		func() error { return err })()

	if arg.IncludeTranscript {
		if arg.ConvID == nil {
			return errors.New("invalid arguments: IncludeTranscript is true but ConvID == nil")
		}
		return errors.New("`IncludeTranscript` is not implemented")
	}
	postArgs := libkb.HTTPArgs{
		"username": libkb.S{Val: arg.Username},
		"reason":   libkb.S{Val: arg.Reason},
		"comment":  libkb.S{Val: arg.Comment},
	}
	if arg.ConvID != nil {
		postArgs["conv_id"] = libkb.S{Val: *arg.ConvID}
	}
	apiArg := libkb.APIArg{
		Endpoint:    "report/conversation",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        postArgs,
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}

// Legacy RPC and API:

func (h *UserHandler) BlockUser(ctx context.Context, username string) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("UserHandler#BlockUser", func() error { return err })()
	return h.setUserBlock(mctx, username, true)
}

func (h *UserHandler) UnblockUser(ctx context.Context, username string) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("UserHandler#UnblockUser", func() error { return err })()
	return h.setUserBlock(mctx, username, false)
}

func (h *UserHandler) setUserBlock(mctx libkb.MetaContext, username string, block bool) error {
	uid, err := mctx.G().GetUPAKLoader().LookupUID(mctx.Ctx(), libkb.NewNormalizedUsername(username))
	if err != nil {
		return err
	}
	apiArg := libkb.APIArg{
		Endpoint:    "user/block",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"block_uid": libkb.S{Val: uid.String()},
			"unblock":   libkb.B{Val: !block},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	_ = mctx.G().CardCache().Delete(uid)
	return err
}
