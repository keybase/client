package teams

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type member struct {
	version    keybase1.UserVersion
	perUserKey keybase1.PerUserKey
}

type memberSet struct {
	Owners     []member
	Admins     []member
	Writers    []member
	Readers    []member
	None       []member
	recipients map[keybase1.UID]keybase1.PerUserKey
}

func newMemberSet() *memberSet {
	return &memberSet{recipients: make(map[keybase1.UID]keybase1.PerUserKey)}
}

func newMemberSetChange(ctx context.Context, g *libkb.GlobalContext, req keybase1.TeamChangeReq) (*memberSet, error) {
	set := newMemberSet()
	if err := set.loadMembers(ctx, g, req); err != nil {
		return nil, err
	}
	return set, nil
}

func (m *memberSet) loadMembers(ctx context.Context, g *libkb.GlobalContext, req keybase1.TeamChangeReq) error {
	var err error
	m.Owners, err = m.loadGroup(ctx, g, req.Owners, true)
	if err != nil {
		return err
	}
	m.Admins, err = m.loadGroup(ctx, g, req.Admins, true)
	if err != nil {
		return err
	}
	m.Writers, err = m.loadGroup(ctx, g, req.Writers, true)
	if err != nil {
		return err
	}
	m.Readers, err = m.loadGroup(ctx, g, req.Readers, true)
	if err != nil {
		return err
	}
	m.None, err = m.loadGroup(ctx, g, req.None, false)
	if err != nil {
		return err
	}
	return nil
}

func (m *memberSet) loadGroup(ctx context.Context, g *libkb.GlobalContext, group []keybase1.UID, storeRecipient bool) ([]member, error) {
	members := make([]member, len(group))
	var err error
	for i, uid := range group {
		members[i], err = m.loadMember(ctx, g, uid, storeRecipient)
		if err != nil {
			return nil, err
		}
	}
	return members, nil
}

func (m *memberSet) loadMember(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID, storeRecipient bool) (member, error) {
	// load upak for uid
	arg := libkb.NewLoadUserByUIDArg(ctx, g, uid)
	upak, _, err := g.GetUPAKLoader().Load(arg)
	if err != nil {
		return member{}, err
	}

	// find the most recent per-user key
	var key keybase1.PerUserKey
	for _, puk := range upak.Base.PerUserKeys {
		if puk.Seqno > key.Seqno {
			key = puk
		}
	}

	// store the key in a recipients table
	if storeRecipient {
		m.recipients[upak.Base.Uid] = key
	}

	// return a member with UserVersion and a PerUserKey
	return member{
		version:    NewUserVersion(upak.Base.Uid, upak.Base.EldestSeqno),
		perUserKey: key,
	}, nil

}

type MemberChecker interface {
	IsMember(context.Context, keybase1.UID) bool
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
	noneMap := make(map[keybase1.UID]bool)
	for _, n := range m.None {
		noneMap[n.version.Uid] = true
	}

	for _, u := range existing.AllUIDs() {
		if noneMap[u] {
			continue
		}
		if _, ok := m.recipients[u]; ok {
			continue
		}
		if _, err := m.loadMember(ctx, g, u, true); err != nil {
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

func (m *memberSet) Section(teamID keybase1.TeamID) (SCTeamSection, error) {
	teamSection := SCTeamSection{
		ID:      (SCTeamID)(teamID),
		Members: new(SCTeamMembers),
	}
	var err error
	teamSection.Members.Owners, err = m.nameSeqList(m.Owners)
	if err != nil {
		return SCTeamSection{}, err
	}
	teamSection.Members.Admins, err = m.nameSeqList(m.Admins)
	if err != nil {
		return SCTeamSection{}, err
	}
	teamSection.Members.Writers, err = m.nameSeqList(m.Writers)
	if err != nil {
		return SCTeamSection{}, err
	}
	teamSection.Members.Readers, err = m.nameSeqList(m.Readers)
	if err != nil {
		return SCTeamSection{}, err
	}
	teamSection.Members.None, err = m.nameSeqList(m.None)
	if err != nil {
		return SCTeamSection{}, err
	}

	return teamSection, nil
}

func (m *memberSet) HasRemoval() bool {
	return len(m.None) > 0
}
