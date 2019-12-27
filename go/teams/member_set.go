package teams

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type storeMemberKind int

const (
	storeMemberKindNone = iota
	storeMemberKindRecipient
	storeMemberKindRestrictedBotRecipient
)

type member struct {
	version    keybase1.UserVersion
	perUserKey keybase1.PerUserKey
}

type MemberMap map[keybase1.UserVersion]keybase1.PerUserKey

type memberSet struct {
	Owners         []member
	Admins         []member
	Writers        []member
	Readers        []member
	Bots           []member
	RestrictedBots []member
	None           []member

	// the per-user-keys of everyone in the lists above
	recipients              MemberMap
	restrictedBotRecipients MemberMap
	restrictedBotSettings   map[keybase1.UserVersion]keybase1.TeamBotSettings
}

func newMemberSet() *memberSet {
	return &memberSet{
		recipients:              make(MemberMap),
		restrictedBotRecipients: make(MemberMap),
		restrictedBotSettings:   make(map[keybase1.UserVersion]keybase1.TeamBotSettings),
	}
}

func (m MemberMap) Eq(n MemberMap) bool {
	if m == nil && n == nil {
		return true
	}
	if m == nil || n == nil {
		return false
	}
	if len(m) != len(n) {
		return false
	}
	for k, v := range m {
		if n[k] != v {
			return false
		}
	}
	return true
}

func newMemberSetChange(ctx context.Context, g *libkb.GlobalContext, req keybase1.TeamChangeReq) (*memberSet, error) {
	set := newMemberSet()
	if err := set.loadMembers(ctx, g, req, true /* forcePoll*/); err != nil {
		return nil, err
	}
	for uv, settings := range req.RestrictedBots {
		set.restrictedBotSettings[uv] = settings
	}
	return set, nil
}

func (m *memberSet) recipientUids() []keybase1.UID {
	uids := make([]keybase1.UID, 0, len(m.recipients))
	for uv := range m.recipients {
		uids = append(uids, uv.Uid)
	}
	return uids
}

func (m *memberSet) restrictedBotRecipientUids() []keybase1.UID {
	uids := make([]keybase1.UID, 0, len(m.restrictedBotRecipients))
	for uv := range m.restrictedBotRecipients {
		uids = append(uids, uv.Uid)
	}
	return uids
}

func (m *memberSet) appendMemberSet(other *memberSet) {
	m.Owners = append(m.Owners, other.Owners...)
	m.Admins = append(m.Admins, other.Admins...)
	m.Writers = append(m.Writers, other.Writers...)
	m.Readers = append(m.Readers, other.Readers...)
	m.Bots = append(m.Bots, other.Bots...)
	m.RestrictedBots = append(m.RestrictedBots, other.RestrictedBots...)
	m.None = append(m.None, other.None...)

	for k, v := range other.recipients {
		m.recipients[k] = v
	}
	for k, v := range other.restrictedBotRecipients {
		m.restrictedBotRecipients[k] = v
	}
	for k, v := range other.restrictedBotSettings {
		m.restrictedBotSettings[k] = v
	}
}

func (m *memberSet) nonAdmins() []member {
	var ret []member
	ret = append(ret, m.RestrictedBots...)
	ret = append(ret, m.Bots...)
	ret = append(ret, m.Readers...)
	ret = append(ret, m.Writers...)
	return ret
}

func (m *memberSet) adminAndOwnerRecipients() MemberMap {
	ret := MemberMap{}
	for _, owner := range m.Owners {
		ret[owner.version] = owner.perUserKey
	}
	for _, admin := range m.Admins {
		ret[admin.version] = admin.perUserKey
	}
	return ret
}

func (m *memberSet) loadMembers(ctx context.Context, g *libkb.GlobalContext, req keybase1.TeamChangeReq, forcePoll bool) error {
	var err error
	m.Owners, err = m.loadGroup(ctx, g, req.Owners, storeMemberKindRecipient, forcePoll)
	if err != nil {
		return err
	}
	m.Admins, err = m.loadGroup(ctx, g, req.Admins, storeMemberKindRecipient, forcePoll)
	if err != nil {
		return err
	}
	m.Writers, err = m.loadGroup(ctx, g, req.Writers, storeMemberKindRecipient, forcePoll)
	if err != nil {
		return err
	}
	m.Readers, err = m.loadGroup(ctx, g, req.Readers, storeMemberKindRecipient, forcePoll)
	if err != nil {
		return err
	}
	// regular bots do get the PTK, store them as a regular recipient
	m.Bots, err = m.loadGroup(ctx, g, req.Bots, storeMemberKindRecipient, forcePoll)
	if err != nil {
		return err
	}
	// restricted bots are not recipients of of the PTK
	m.RestrictedBots, err = m.loadGroup(ctx, g, req.RestrictedBotUVs(), storeMemberKindRestrictedBotRecipient, forcePoll)
	if err != nil {
		return err
	}
	m.None, err = m.loadGroup(ctx, g, req.None, storeMemberKindNone, false)
	return err
}

func (m *memberSet) loadGroup(ctx context.Context, g *libkb.GlobalContext,
	group []keybase1.UserVersion, storeMemberKind storeMemberKind, forcePoll bool) ([]member, error) {

	var members []member
	for _, uv := range group {
		mem, err := m.loadMember(ctx, g, uv, storeMemberKind, forcePoll)
		if _, reset := err.(libkb.AccountResetError); reset {
			switch storeMemberKind {
			case storeMemberKindNone:
				// If caller doesn't care about keys, it probably expects
				// reset users to be passed through as well. This is used
				// in reading reset users in impteams.
				members = append(members, member{version: uv})
			default:
				g.Log.CDebugf(ctx, "Skipping reset account %s in team load", uv.String())
			}
			continue
		}
		if err != nil {
			return nil, err
		}
		members = append(members, mem)
	}
	return members, nil
}

func loadUPAK2(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID, forcePoll bool) (ret *keybase1.UserPlusKeysV2AllIncarnations, err error) {
	defer g.CTrace(ctx, fmt.Sprintf("loadUPAK2(%s)", uid), func() error { return err })()

	arg := libkb.NewLoadUserArg(g).WithNetContext(ctx).WithUID(uid).WithPublicKeyOptional()
	if forcePoll {
		arg = arg.WithForcePoll(true)
	}
	upak, _, err := g.GetUPAKLoader().LoadV2(arg)
	return upak, err
}

func parseSocialAssertion(m libkb.MetaContext, username string) (typ string, name string, err error) {
	assertion, err := libkb.ParseAssertionURL(m.G().MakeAssertionContext(m), username, false)
	if err != nil {
		return "", "", err
	}
	if assertion.IsKeybase() {
		return "", "", fmt.Errorf("invalid user assertion %q, keybase assertion should be handled earlier", username)
	}
	typ, name = assertion.ToKeyValuePair()

	return typ, name, nil
}

func memberFromUPAK(ctx context.Context, requestedUV keybase1.UserVersion, upak *keybase1.UserPlusKeysV2AllIncarnations) (member, error) {
	if upak == nil {
		return member{}, fmt.Errorf("got nil upak")
	}
	if upak.Current.EldestSeqno != requestedUV.EldestSeqno {
		return member{}, libkb.NewAccountResetError(requestedUV, upak.Current.EldestSeqno)
	}
	key := upak.Current.GetLatestPerUserKey()
	if key == nil || key.Gen <= 0 {
		return member{}, fmt.Errorf("user has no per-user key: %s", requestedUV.String())
	}
	return member{
		version:    NewUserVersion(upak.Current.Uid, upak.Current.EldestSeqno),
		perUserKey: *key,
	}, nil
}

func loadMember(ctx context.Context, g *libkb.GlobalContext, uv keybase1.UserVersion, forcePoll bool) (mem member, err error) {
	defer g.CTrace(ctx, fmt.Sprintf("loadMember(%s, forcePoll=%t)", uv, forcePoll), func() error { return err })()

	upak, err := loadUPAK2(ctx, g, uv.Uid, forcePoll)
	if err != nil {
		if _, reset := err.(libkb.NoKeyError); reset {
			err = libkb.NewAccountResetError(uv, keybase1.Seqno(0))
		}
		return mem, err
	}

	mem, err = memberFromUPAK(ctx, uv, upak)
	if err != nil {
		return mem, err
	}

	return mem, nil
}

func (m *memberSet) loadMember(ctx context.Context, g *libkb.GlobalContext, uv keybase1.UserVersion, storeMemberKind storeMemberKind, forcePoll bool) (mem member, err error) {
	mem, err = loadMember(ctx, g, uv, forcePoll)
	if err != nil {
		return mem, err
	}
	m.storeMember(ctx, g, mem, storeMemberKind)
	return mem, nil
}

func (m *memberSet) storeMember(ctx context.Context, g *libkb.GlobalContext, mem member, storeMemberKind storeMemberKind) {
	switch storeMemberKind {
	case storeMemberKindRecipient:
		m.recipients[mem.version] = mem.perUserKey
	case storeMemberKindRestrictedBotRecipient:
		m.restrictedBotRecipients[mem.version] = mem.perUserKey
	}
}

type MemberChecker interface {
	IsMember(context.Context, keybase1.UserVersion) bool
	MemberRole(context.Context, keybase1.UserVersion) (keybase1.TeamRole, error)
}

func (m *memberSet) removeExistingMembers(ctx context.Context, checker MemberChecker) {
	for uv := range m.recipients {
		if checker.IsMember(ctx, uv) {
			existingRole, err := checker.MemberRole(ctx, uv)
			// If we were previously a RESTRICTEDBOT, we now need to be boxed
			// for the PTK so we skip removal.
			if err == nil && existingRole.IsRestrictedBot() {
				continue
			}
			delete(m.recipients, uv)
		}
	}
	for uv := range m.restrictedBotRecipients {
		if checker.IsMember(ctx, uv) {
			delete(m.restrictedBotRecipients, uv)
			delete(m.restrictedBotSettings, uv)
		}
	}
}

// AddRemainingRecipients adds everyone in existing to m.recipients or
// m.restrictedBotRecipients that isn't in m.None.
func (m *memberSet) AddRemainingRecipients(ctx context.Context, g *libkb.GlobalContext, existing keybase1.TeamMembers) (err error) {

	defer g.CTrace(ctx, "memberSet#AddRemainingRecipients", func() error { return err })()

	// make a map of the None members
	filtered := make(map[keybase1.UserVersion]bool)
	for _, n := range m.None {
		filtered[n.version] = true
	}

	existingRestrictedBots := make(map[keybase1.UserVersion]bool)
	for _, uv := range existing.RestrictedBots {
		existingRestrictedBots[uv] = true
	}

	auv := existing.AllUserVersions()
	forceUserPoll := true
	if len(auv) > 50 {
		forceUserPoll = false
	}

	type request struct {
		uv              keybase1.UserVersion
		storeMemberKind storeMemberKind
	}
	var requests []request
	for _, uv := range auv {
		if filtered[uv] {
			continue
		}
		if _, ok := m.recipients[uv]; ok {
			continue
		}
		if _, ok := m.restrictedBotRecipients[uv]; ok {
			continue
		}

		var storeMemberKind storeMemberKind
		if _, ok := existingRestrictedBots[uv]; ok {
			storeMemberKind = storeMemberKindRestrictedBotRecipient
		} else {
			storeMemberKind = storeMemberKindRecipient
		}

		requests = append(requests, request{
			uv:              uv,
			storeMemberKind: storeMemberKind,
		})
	}

	// for UPAK Batcher API
	getArg := func(idx int) *libkb.LoadUserArg {
		if idx >= len(requests) {
			return nil
		}
		arg := libkb.NewLoadUserByUIDArg(ctx, g, requests[idx].uv.Uid).WithPublicKeyOptional().WithForcePoll(forceUserPoll)
		return &arg
	}
	// for UPAK Batcher API
	processResult := func(idx int, upak *keybase1.UserPlusKeysV2AllIncarnations) error {
		mem, err := memberFromUPAK(ctx, requests[idx].uv, upak)
		if err != nil {
			return err
		}
		m.storeMember(ctx, g, mem, requests[idx].storeMemberKind)
		return nil
	}
	// for UPAK Batcher API
	ignoreError := func(err error) bool {
		//TODO
		return false
	}
	err = g.GetUPAKLoader().Batcher(ctx, getArg, processResult, ignoreError, 0)
	if err != nil {
		return err
	}

	return nil
}

func (m *memberSet) nameSeqList(members []member) (*[]SCTeamMember, error) {
	if len(members) == 0 {
		return nil, nil
	}
	res := make([]SCTeamMember, len(members))
	for i, m := range members {
		res[i] = SCTeamMember(m.version)
	}
	return &res, nil
}

// can return nil
func (m *memberSet) Section() (res *SCTeamMembers, err error) {
	if m.empty() {
		return nil, nil
	}

	res = &SCTeamMembers{}
	res.Owners, err = m.nameSeqList(m.Owners)
	if err != nil {
		return nil, err
	}
	res.Admins, err = m.nameSeqList(m.Admins)
	if err != nil {
		return nil, err
	}
	res.Writers, err = m.nameSeqList(m.Writers)
	if err != nil {
		return nil, err
	}
	res.Readers, err = m.nameSeqList(m.Readers)
	if err != nil {
		return nil, err
	}
	res.Bots, err = m.nameSeqList(m.Bots)
	if err != nil {
		return nil, err
	}
	res.RestrictedBots, err = m.nameSeqList(m.RestrictedBots)
	if err != nil {
		return nil, err
	}
	res.None, err = m.nameSeqList(m.None)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (m *memberSet) HasRemoval() bool {
	return len(m.None) > 0
}

func (m *memberSet) HasAdditions() bool {
	return (len(m.Owners) + len(m.Admins) + len(m.Writers) + len(m.Readers) + len(m.Bots) + len(m.RestrictedBots)) > 0
}

func (m *memberSet) empty() bool {
	return len(m.Owners) == 0 && len(m.Admins) == 0 && len(m.Writers) == 0 && len(m.Readers) == 0 && len(m.Bots) == 0 && len(m.RestrictedBots) == 0 && len(m.None) == 0
}
