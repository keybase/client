// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/avatars"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// UserHandler is the RPC handler for the user interface.
type UserHandler struct {
	*BaseHandler
	libkb.Contextified
	globals.ChatContextified
}

// NewUserHandler creates a UserHandler for the xp transport.
func NewUserHandler(xp rpc.Transporter, g *libkb.GlobalContext, chatG *globals.ChatContext) *UserHandler {
	return &UserHandler{
		BaseHandler:      NewBaseHandler(g, xp),
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(chatG),
	}
}

// ListTrackers gets the list of trackers for a user by uid.
func (h *UserHandler) ListTrackers(ctx context.Context, arg keybase1.ListTrackersArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackers(h.G(), arg.Uid)
	return h.listTrackers(ctx, arg.SessionID, eng)
}

// ListTrackersByName gets the list of trackers for a user by
// username.
func (h *UserHandler) ListTrackersByName(ctx context.Context, arg keybase1.ListTrackersByNameArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersByName(arg.Username)
	return h.listTrackers(ctx, arg.SessionID, eng)
}

// ListTrackersSelf gets the list of trackers for the logged in
// user.
func (h *UserHandler) ListTrackersSelf(ctx context.Context, sessionID int) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersSelf()
	return h.listTrackers(ctx, sessionID, eng)
}

func (h *UserHandler) listTrackers(ctx context.Context, sessionID int, eng *engine.ListTrackersEngine) ([]keybase1.Tracker, error) {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SessionID: sessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		return nil, err
	}
	res := eng.ExportedList()
	return res, nil
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

func (h *UserHandler) LoadUserPlusKeysV2(netCtx context.Context, arg keybase1.LoadUserPlusKeysV2Arg) (ret keybase1.UserPlusKeysV2AllIncarnations, err error) {
	netCtx = libkb.WithLogTag(netCtx, "LUPK2")
	defer h.G().CTrace(netCtx, fmt.Sprintf("UserHandler#LoadUserPlusKeysV2(%+v)", arg), func() error { return err })()
	p, err := h.G().GetUPAKLoader().LoadV2WithKID(netCtx, arg.Uid, arg.PollForKID)
	if p != nil {
		ret = *p
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
		// (like libkb.DeletedError, for example)
		err = libkb.UserErrorFromStatus(ret.Status)
		if err != nil {
			h.G().Log.CDebugf(netCtx, "using error from StatusCode: %v => %s", ret.Status, err)
		}
	}

	h.G().Log.CDebugf(netCtx, "- UserHandler#LoadUserPlusKeys(%+v) -> (UVV=%+v, KIDs=%v, err=%s)", arg, ret.Uvv, kids, libkb.ErrToOk(err))
	return ret, err
}

func (h *UserHandler) LoadMySettings(ctx context.Context, sessionID int) (us keybase1.UserSettings, err error) {
	emails, err := libkb.LoadUserEmails(h.G())
	if err != nil {
		return
	}
	us.Emails = emails
	return
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
	defer m.CTrace(fmt.Sprintf("ListTrackers2(assertion=%s,reverse=%v)", arg.Assertion, arg.Reverse),
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

func (h *UserHandler) loadUsername(ctx context.Context, uid keybase1.UID) (string, error) {
	arg := libkb.NewLoadUserByUIDArg(ctx, h.G(), uid).WithPublicKeyOptional().WithStaleOK(true).WithCachedOnly()
	upak, _, err := h.G().GetUPAKLoader().Load(arg)
	if err != nil {
		return "", err
	}
	return upak.GetName(), nil
}

func (h *UserHandler) InterestingPeople(ctx context.Context, maxUsers int) (res []keybase1.InterestingPerson, err error) {

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

	ip := newInterestingPeople(h.G())

	// Add sources of interesting people
	ip.AddSource(chatFn, 0.9)
	ip.AddSource(followerFn, 0.1)

	uids, err := ip.Get(ctx, maxUsers)
	if err != nil {
		h.G().Log.Debug("InterestingPeople: failed to get list: %s", err.Error())
		return nil, err
	}

	// List of test uids for localhost test

	// remove me

	uids = []keybase1.UID{
		"a042efb5322212beaf7121e3eff0c119",
		"924a9514b0730fe12f15dd2e4a110e19",
		"06308a58f6f4aace340614cb4ac82d19",
		"1e265ee073746a6320d4a104da6f0219",
		"1fbdfca5bae16589be0501c322fcdc19",
		"237742fe16c15d4a7c58371810b8d119",
		"4a0dcae3e99f29b53e87a6ff8e2d0719",
		"65712122ad2d188f754183f8cf3bfd19",
		"6bad2cabe59a8c4749ee73d2338dcc19",
		"6e0435d5a8a5befe10a138c6d549ee19",
		"934dc10daa788dfce9043ad222c97c19",
		"9ba90c5133d484d344b60b6efbbe3719",
		"ade6c51d4734aa5a6cda789927cb4819",
		"b1bbdab06f5c0efce42f3e8591042f19",
		"b1e9f2ff4dc6a0e726b120f48835b119",
		"b427b1e4a53df4c5b4adb22e8ca45919",
		"b704a7212bc0900394ef4adbe1ef5019",
		"cfd6d64fe99a048e27e31b73350e1f19",
		"db54a1fedd2ac8770be1b43353df4d19",
		"f0260392b1b6d93e2d6408ac246ee719",
		"f3783e5275e9d3d64f290deef6326e19",
		"f39526a5aa3ecc7de36a2c372f8b3519",
		"f45aa074b2a88d3dbf3236826892be19",
		"f6b0e03cff3e8548d4b7e7bdbcf19c19",
		"00426f2ad390b16a58f29606944e0319",
		"031219912f767ae63cc4008e97dcb919",
		"07b6219502cc285be2017ab2d3480a19",
		"0b62a17c242cd3e19a708c2306ed1119",
		"1b41e5f0e2420f3c9f088ed235a8be19",
		"1b8e063d6fcd08c25fc0da360f420119",
	}

	if len(uids) == 0 {
		h.G().Log.Debug("InterestingPeople: there are no interesting people for current user")
		return []keybase1.InterestingPerson{}, nil
	}

	const fullnameFreshness = 10 * time.Minute
	const networkTimeBudget = 0
	packages, err := h.G().UIDMapper.MapUIDsToUsernamePackages(ctx, h.G(), uids,
		fullnameFreshness, networkTimeBudget, true /* forceNetworkForFullNames */)
	if err != nil {
		h.G().Log.Debug("InterestingPeople: failed in UIDMapper: %s, but continuing", err.Error())
	}

	for i, u := range uids {
		if err != nil {
			h.G().Log.Debug("InterestingPeople: failed to get username for: %s msg: %s", u, err.Error())
			continue
		}
		if packages[i].NormalizedUsername.IsNil() {
			// If we errored in UIDMapper, some data might be missing.
			continue
		}
		ret := keybase1.InterestingPerson{
			Uid:      u,
			Username: packages[i].NormalizedUsername.String(),
		}
		if fn := packages[i].FullName; fn != nil {
			ret.Fullname = fn.FullName.String()
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
	defer mctx.CTraceTimed("ProofSuggestions", func() error { return err })()
	suggestions, err := h.proofSuggestionsHelper(mctx)
	if err != nil {
		return ret, err
	}
	foldPriority := mctx.G().GetProofServices().SuggestionFoldPriority()
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
	Priority int
}

var pgpProofSuggestion = keybase1.ProofSuggestion{
	Key:           "pgp",
	ProfileText:   "Add a PGP key",
	PickerText:    "PGP key",
	PickerSubtext: "",
}

var webProofSuggestion = keybase1.ProofSuggestion{
	Key:           "web",
	ProfileText:   "Prove your website",
	PickerText:    "Your own website",
	PickerSubtext: "",
}

var bitcoinProofSuggestion = keybase1.ProofSuggestion{
	Key:           "btc",
	ProfileText:   "Set a Bitcoin address",
	PickerText:    "Bitcoin address",
	PickerSubtext: "",
}

var zcashProofSuggestion = keybase1.ProofSuggestion{
	Key:           "zcash",
	ProfileText:   "Set a Zcash address",
	PickerText:    "Zcash address",
	PickerSubtext: "",
}

func (h *UserHandler) proofSuggestionsHelper(mctx libkb.MetaContext) (ret []ProofSuggestion, err error) {
	user, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(mctx).WithPublicKeyOptional())
	if err != nil {
		return ret, err
	}
	if user == nil {
		return ret, fmt.Errorf("could not load logged-in user")
	}

	var suggestions []ProofSuggestion
	serviceKeys := mctx.G().GetProofServices().ListServicesThatAcceptNewProofs(mctx)
	for _, service := range serviceKeys {
		switch service {
		case "web", "dns", "http", "https":
			// These are under the "web" umbrella.
			// "web" is added below.
			continue
		}
		serviceType := mctx.G().GetProofServices().GetServiceType(service)
		if serviceType == nil {
			mctx.CDebugf("missing proof service type: %v", service)
			continue
		}
		if len(user.IDTable().GetActiveProofsFor(serviceType)) > 0 {
			mctx.CDebugf("user has an active proof: %v", serviceType.Key())
			continue
		}
		subtext := serviceType.DisplayGroup()
		if len(subtext) == 0 {
			subtext = serviceType.PickerSubtext()
		}
		suggestions = append(suggestions, ProofSuggestion{ProofSuggestion: keybase1.ProofSuggestion{
			Key:           service,
			ProfileText:   fmt.Sprintf("Prove your %v", serviceType.DisplayName()),
			PickerText:    serviceType.DisplayName(),
			PickerSubtext: subtext,
		}})
	}
	hasPGP := len(user.GetActivePGPKeys(true)) > 0
	if !hasPGP {
		suggestions = append(suggestions, ProofSuggestion{ProofSuggestion: pgpProofSuggestion})
	}
	// Always show the option to create a new web proof.
	suggestions = append(suggestions, ProofSuggestion{ProofSuggestion: webProofSuggestion})
	if !user.IDTable().HasActiveCryptocurrencyFamily(libkb.CryptocurrencyFamilyBitcoin) {
		suggestions = append(suggestions, ProofSuggestion{ProofSuggestion: bitcoinProofSuggestion})
	}
	if !user.IDTable().HasActiveCryptocurrencyFamily(libkb.CryptocurrencyFamilyZCash) {
		suggestions = append(suggestions, ProofSuggestion{ProofSuggestion: zcashProofSuggestion})
	}

	// Attach icon urls
	for i := range suggestions {
		suggestion := &suggestions[i]
		suggestion.ProfileIcon = externals.MakeIcons(mctx, suggestion.Key, "logo_black", 16)
		if externals.ServiceHasFullIcon(suggestion.Key) {
			suggestion.PickerIcon = externals.MakeIcons(mctx, suggestion.Key, "logo_full", 32)
		}
	}

	// Alphabetize so that ties later on in SliceStable are deterministic.
	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].Key < suggestions[j].Key
	})

	// Priorities from the server.
	serverPriority := make(map[string]int) // key -> server priority
	maxServerPriority := 0
	for _, displayConfig := range mctx.G().GetProofServices().ListDisplayConfigs() {
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

	sort.SliceStable(suggestions, func(i, j int) bool {
		return suggestions[i].Priority < suggestions[j].Priority
	})
	return suggestions, nil
}

func (h *UserHandler) FindNextMerkleRootAfterRevoke(ctx context.Context, arg keybase1.FindNextMerkleRootAfterRevokeArg) (ret keybase1.NextMerkleRootRes, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	m = m.WithLogTag("FNMR")
	defer m.CTraceTimed("UserHandler#FindNextMerkleRootAfterRevoke", func() error { return err })()
	return libkb.FindNextMerkleRootAfterRevoke(m, arg)
}

func (h *UserHandler) FindNextMerkleRootAfterReset(ctx context.Context, arg keybase1.FindNextMerkleRootAfterResetArg) (ret keybase1.NextMerkleRootRes, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	m = m.WithLogTag("FNMR")
	defer m.CTraceTimed("UserHandler#FindNextMerkleRootAfterReset", func() error { return err })()
	return libkb.FindNextMerkleRootAfterReset(m, arg)
}

func (h *UserHandler) LoadHasRandomPw(ctx context.Context, arg keybase1.LoadHasRandomPwArg) (res bool, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	m = m.WithLogTag("HASRPW")
	defer m.CTraceTimed(fmt.Sprintf("UserHandler#LoadHasRandomPw(forceRepoll=%t)", arg.ForceRepoll), func() error { return err })()

	meUID := m.G().ActiveDevice.UID()
	cacheKey := libkb.DbKey{
		Typ: libkb.DBHasRandomPW,
		Key: meUID.String(),
	}

	var cachedValue, hasCache bool
	if !arg.ForceRepoll {
		if hasCache, err = m.G().GetKVStore().GetInto(&cachedValue, cacheKey); err == nil {
			if hasCache && !cachedValue {
				m.CDebugf("Returning HasRandomPW=false from KVStore cache")
				return false, nil
			}
			// If it was never cached or user *IS* RandomPW right now, pass through
			// and call the API.
		} else {
			m.CDebugf("Unable to get cached value for HasRandomPW: %v", err)
		}
	}

	var initialTimeout time.Duration
	if !arg.ForceRepoll {
		// If we are do not need accurate response from the API server, make
		// the request with a timeout for quicker overall RPC response time
		// if network is bad/unavailable.
		initialTimeout = 3 * time.Second
	}

	var ret struct {
		libkb.AppStatusEmbed
		RandomPW bool `json:"random_pw"`
	}
	err = h.G().API.GetDecode(libkb.APIArg{
		Endpoint:       "user/has_random_pw",
		SessionType:    libkb.APISessionTypeREQUIRED,
		NetContext:     ctx,
		InitialTimeout: initialTimeout,
	}, &ret)
	if err != nil {
		if !arg.ForceRepoll {
			if hasCache {
				// We are allowed to return cache if we have any.
				m.CWarningf("Unable to make a network request to has_random_pw. Returning cached value: %t", cachedValue)
				return cachedValue, nil
			}

			m.CWarningf("Unable to make a network request to has_random_pw and there is no cache. Erroring out.")
		}
		return res, err
	}

	if !hasCache || cachedValue != ret.RandomPW {
		// Cache current state. If we put `randomPW=false` in the cache, we will never
		// ever have to call to the network from this device, because it's not possible
		// to become `randomPW=true` again. If we cache `randomPW=true` we are going to
		// keep asking the network, but we will be resilient to bad network conditions
		// because we will have this cached state to fall back on.
		if err := m.G().GetKVStore().PutObj(cacheKey, nil, ret.RandomPW); err == nil {
			m.CDebugf("Adding HasRandomPW=%t to KVStore", ret.RandomPW)
		} else {
			m.CDebugf("Unable to add HasRandomPW state to KVStore")
		}
	}

	return ret.RandomPW, err
}

func (h *UserHandler) CanLogout(ctx context.Context, sessionID int) (res keybase1.CanLogoutRes, err error) {
	hasRandomPW, err := h.LoadHasRandomPw(ctx, keybase1.LoadHasRandomPwArg{
		SessionID:   sessionID,
		ForceRepoll: false,
	})

	if err != nil {
		return keybase1.CanLogoutRes{
			CanLogout: false,
			Reason:    fmt.Sprintf("Cannot check user state: %s", err.Error()),
		}, nil
	}

	if hasRandomPW {
		return keybase1.CanLogoutRes{
			CanLogout: false,
			Reason:    "You signed up without a password and need to set a password first.",
		}, nil
	}

	res.CanLogout = true
	return res, nil
}
