package teams

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type member struct {
	version    UserVersion
	perUserKey keybase1.PerUserKey
}

type memberSet struct {
	Owners     *[]member
	Admins     *[]member
	Writers    *[]member
	Readers    *[]member
	None       *[]member
	recipients map[string]keybase1.PerUserKey
}

func newMemberSet(ctx context.Context, g *libkb.GlobalContext, req ChangeReq) (*memberSet, error) {
	set := &memberSet{recipients: make(map[string]keybase1.PerUserKey)}
	if err := set.loadMembers(ctx, g, req); err != nil {
		return nil, err
	}
	return set, nil
}

func (m *memberSet) loadMembers(ctx context.Context, g *libkb.GlobalContext, req ChangeReq) error {
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

func (m *memberSet) loadGroup(ctx context.Context, g *libkb.GlobalContext, group *[]string) (*[]member, error) {
	if group == nil {
		return nil, nil
	}

	members := make([]member, len(*group))
	var err error
	for i, username := range *group {
		members[i], err = m.loadMember(ctx, g, username)
		if err != nil {
			return nil, err
		}
	}
	return &members, nil
}

func (m *memberSet) loadMember(ctx context.Context, g *libkb.GlobalContext, username string) (member, error) {
	user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(g, username))
	if err != nil {
		return member{}, err
	}
	key := user.GetComputedKeyFamily().GetLatestPerUserKey()
	if key == nil {
		return member{}, errors.New("user does not have per-user key")
	}

	version, err := loadUserVersionByUsername(ctx, g, username)

	m.recipients[user.GetName()] = *key

	return member{
		version:    version,
		perUserKey: *key,
	}, nil

}

func (m *memberSet) nameSeqList(members *[]member) (*[]SCTeamMember, error) {
	if members == nil {
		return nil, nil
	}
	res := make([]SCTeamMember, len(*members))
	for i, m := range *members {
		nameSeq, err := libkb.MakeNameWithEldestSeqno(m.version.Username.String(), m.version.EldestSeqno)
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
