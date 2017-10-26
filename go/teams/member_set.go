package teams

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type member struct {
	version    keybase1.UserVersion
	perUserKey keybase1.PerUserKey
}

type memberSet struct {
	Owners  []member
	Admins  []member
	Writers []member
	Readers []member
	None    []member

	// the per-user-keys of everyone in the lists above
	recipients map[keybase1.UserVersion]keybase1.PerUserKey
}

func newMemberSet() *memberSet {
	return &memberSet{recipients: make(map[keybase1.UserVersion]keybase1.PerUserKey)}
}

func newMemberSetChange(ctx context.Context, g *libkb.GlobalContext, req keybase1.TeamChangeReq) (*memberSet, error) {
	set := newMemberSet()
	if err := set.loadMembers(ctx, g, req, true /* forcePoll*/); err != nil {
		return nil, err
	}
	return set, nil
}

func (m *memberSet) nonAdmins() []member {
	var ret []member
	ret = append(ret, m.Readers...)
	ret = append(ret, m.Writers...)
	return ret
}

func (m *memberSet) adminAndOwnerRecipients() map[keybase1.UserVersion]keybase1.PerUserKey {
	ret := map[keybase1.UserVersion]keybase1.PerUserKey{}
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
	m.Owners, err = m.loadGroup(ctx, g, req.Owners, true, forcePoll)
	if err != nil {
		return err
	}
	m.Admins, err = m.loadGroup(ctx, g, req.Admins, true, forcePoll)
	if err != nil {
		return err
	}
	m.Writers, err = m.loadGroup(ctx, g, req.Writers, true, forcePoll)
	if err != nil {
		return err
	}
	m.Readers, err = m.loadGroup(ctx, g, req.Readers, true, forcePoll)
	if err != nil {
		return err
	}
	m.None, err = m.loadGroup(ctx, g, req.None, false, false)
	return err
}

func (m *memberSet) loadGroup(ctx context.Context, g *libkb.GlobalContext, group []keybase1.UserVersion, storeRecipient, force bool) ([]member, error) {
	var members []member
	for _, uv := range group {
		mem, err := m.loadMember(ctx, g, uv, storeRecipient, force)
		if _, reset := err.(libkb.AccountResetError); reset {
			if !storeRecipient {
				// If caller doesn't care about keys, it probably expects
				// reset users to be passed through as well. This is used
				// in readding reset users in impteams.
				members = append(members, member{version: uv})
			} else {
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

func loadMember(ctx context.Context, g *libkb.GlobalContext, uv keybase1.UserVersion, forcePoll bool) (mem member, nun libkb.NormalizedUsername, err error) {
	defer g.CTrace(ctx, fmt.Sprintf("loadMember(%s)", uv), func() error { return err })()

	upak, err := loadUPAK2(ctx, g, uv.Uid, forcePoll)

	if upak != nil {
		nun = libkb.NewNormalizedUsername(upak.Current.Username)
	}

	if err != nil {
		if _, reset := err.(libkb.NoKeyError); reset {
			err = libkb.NewAccountResetError(uv, keybase1.Seqno(0))
		}
		return member{}, nun, err
	}

	if upak.Current.EldestSeqno != uv.EldestSeqno {
		return member{}, nun, libkb.NewAccountResetError(uv, upak.Current.EldestSeqno)
	}

	// find the most recent per-user key
	var key keybase1.PerUserKey
	for _, puk := range upak.Current.PerUserKeys {
		if puk.Seqno > key.Seqno {
			key = puk
		}
	}

	// return a member with UserVersion and a PerUserKey
	return member{
		version:    NewUserVersion(upak.Current.Uid, upak.Current.EldestSeqno),
		perUserKey: key,
	}, nun, nil
}

func (m *memberSet) loadMember(ctx context.Context, g *libkb.GlobalContext, uv keybase1.UserVersion, storeRecipient, forcePoll bool) (res member, err error) {
	res, _, err = loadMember(ctx, g, uv, forcePoll)
	if err != nil {
		return res, err
	}
	// store the key in a recipients table
	if storeRecipient {
		m.recipients[res.version] = res.perUserKey
	}
	return res, nil
}

type MemberChecker interface {
	IsMember(context.Context, keybase1.UserVersion) bool
}

func (m *memberSet) removeExistingMembers(ctx context.Context, checker MemberChecker) {
	for k := range m.recipients {
		if !checker.IsMember(ctx, k) {
			continue
		}
		delete(m.recipients, k)
	}
}

// AddRemainingRecipients adds everyone in existing to m.recipients that isn't in m.None.
func (m *memberSet) AddRemainingRecipients(ctx context.Context, g *libkb.GlobalContext, existing keybase1.TeamMembers) error {
	// make a map of the None members
	noneMap := make(map[keybase1.UserVersion]bool)
	for _, n := range m.None {
		noneMap[n.version] = true
	}

	for _, uv := range existing.AllUserVersions() {
		if noneMap[uv] {
			continue
		}
		if _, ok := m.recipients[uv]; ok {
			continue
		}
		if _, err := m.loadMember(ctx, g, uv, true, true); err != nil {
			if _, reset := err.(libkb.AccountResetError); reset {
				g.Log.CInfof(ctx, "Skipping user was who reset: %s", uv.String())
				continue
			}
			return err
		}
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
	res.None, err = m.nameSeqList(m.None)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (m *memberSet) HasRemoval() bool {
	return len(m.None) > 0
}

func (m *memberSet) empty() bool {
	return len(m.Owners) == 0 && len(m.Admins) == 0 && len(m.Writers) == 0 && len(m.Readers) == 0 && len(m.None) == 0
}
