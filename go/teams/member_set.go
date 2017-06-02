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
	recipients map[string]keybase1.PerUserKey
}

func newMemberSet(ctx context.Context, g *libkb.GlobalContext, req keybase1.TeamChangeReq) (*memberSet, error) {
	set := &memberSet{recipients: make(map[string]keybase1.PerUserKey)}
	if err := set.loadMembers(ctx, g, req); err != nil {
		return nil, err
	}
	return set, nil
}

func (m *memberSet) loadMembers(ctx context.Context, g *libkb.GlobalContext, req keybase1.TeamChangeReq) error {
	var err error
	m.Owners, err = m.loadGroup(ctx, g, req.Owners)
	if err != nil {
		return err
	}
	m.Admins, err = m.loadGroup(ctx, g, req.Admins)
	if err != nil {
		return err
	}
	m.Writers, err = m.loadGroup(ctx, g, req.Writers)
	if err != nil {
		return err
	}
	m.Readers, err = m.loadGroup(ctx, g, req.Readers)
	if err != nil {
		return err
	}
	m.None, err = m.loadGroup(ctx, g, req.None)
	if err != nil {
		return err
	}
	return nil
}

func (m *memberSet) loadGroup(ctx context.Context, g *libkb.GlobalContext, group []string) ([]member, error) {
	members := make([]member, len(group))
	var err error
	for i, username := range group {
		members[i], err = m.loadMember(ctx, g, username)
		if err != nil {
			return nil, err
		}
	}
	return members, nil
}

func (m *memberSet) loadMember(ctx context.Context, g *libkb.GlobalContext, username string) (member, error) {
	// resolve the username
	res := g.Resolver.ResolveWithBody(username)
	if res.GetError() != nil {
		return member{}, res.GetError()
	}

	// load upak for uid
	arg := libkb.NewLoadUserByUIDArg(ctx, g, res.GetUID())
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
	m.recipients[upak.Base.Username] = key

	// return a member with UserVersion and a PerUserKey
	return member{
		version:    NewUserVersion(upak.Base.Username, upak.Base.EldestSeqno),
		perUserKey: key,
	}, nil

}

func (m *memberSet) nameSeqList(members []member) (*[]SCTeamMember, error) {
	if len(members) == 0 {
		return nil, nil
	}
	res := make([]SCTeamMember, len(members))
	for i, m := range members {
		nameSeq, err := libkb.MakeNameWithEldestSeqno(m.version.Username, m.version.EldestSeqno)
		if err != nil {
			return nil, err
		}
		res[i] = SCTeamMember(nameSeq)
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
