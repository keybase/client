package chat

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"golang.org/x/net/context"
)

// KeyFinder remembers results from previous calls to CryptKeys().
type KeyFinder interface {
	Find(ctx context.Context, name string, membersType chat1.ConversationMembersType, public bool) (types.NameInfo, error)
	FindForEncryption(ctx context.Context, tlfName string, teamID chat1.TLFID, membersType chat1.ConversationMembersType, public bool) (types.NameInfo, error)
	FindForDecryption(ctx context.Context, tlfName string, teamID chat1.TLFID, membersType chat1.ConversationMembersType, public bool, keyGeneration int) (types.NameInfo, error)
	SetNameInfoSourceOverride(types.NameInfoSource)
}

type KeyFinderImpl struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	keys map[string]types.NameInfo

	// Testing
	testingNameInfoSource types.NameInfoSource
}

// NewKeyFinder creates a KeyFinder.
func NewKeyFinder(g *globals.Context) KeyFinder {
	return &KeyFinderImpl{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "KeyFinder", false),
		keys:         make(map[string]types.NameInfo),
	}
}

func (k *KeyFinderImpl) cacheKey(name string, membersType chat1.ConversationMembersType, public bool) string {
	return fmt.Sprintf("%s|%v|%v", name, membersType, public)
}

func (k *KeyFinderImpl) createNameInfoSource(ctx context.Context,
	membersType chat1.ConversationMembersType) types.NameInfoSource {
	if k.testingNameInfoSource != nil {
		k.Debug(ctx, "createNameInfoSource: warning: using overridden name info source")
		return k.testingNameInfoSource
	}
	switch membersType {
	case chat1.ConversationMembersType_KBFS:
		return NewKBFSNameInfoSource(k.G())
	case chat1.ConversationMembersType_TEAM:
		return NewTeamsNameInfoSource(k.G())
	}
	k.Debug(ctx, "createNameInfoSource: unknown members type, using KBFS: %v", membersType)
	return NewKBFSNameInfoSource(k.G())
}

// Find finds keybase1.TLFCryptKeys for tlfName, checking for existing
// results.
func (k *KeyFinderImpl) Find(ctx context.Context, name string,
	membersType chat1.ConversationMembersType, public bool) (types.NameInfo, error) {

	ckey := k.cacheKey(name, membersType, public)
	k.Lock()
	existing, ok := k.keys[ckey]
	k.Unlock()
	if ok {
		return existing, nil
	}

	vis := chat1.TLFVisibility_PRIVATE
	if public {
		vis = chat1.TLFVisibility_PUBLIC
	}
	nameSource := k.createNameInfoSource(ctx, membersType)
	nameInfo, err := nameSource.Lookup(ctx, name, vis)
	if err != nil {
		return types.NameInfo{}, err
	}
	if public {
		nameInfo.CryptKeys = append(nameInfo.CryptKeys, publicCryptKey)
	}

	k.Lock()
	k.keys[ckey] = nameInfo
	k.Unlock()

	return nameInfo, nil
}

// Find keys up-to-date enough for encrypting.
// Ignores tlfName or teamID based on membersType.
func (k *KeyFinderImpl) FindForEncryption(ctx context.Context,
	tlfName string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (res types.NameInfo, err error) {

	switch membersType {
	case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAM:
		teamID, err := tlfIDToTeamdID(teamID)
		if err != nil {
			return res, err
		}
		team, err := teams.Load(ctx, k.G().ExternalG(), keybase1.LoadTeamArg{
			ID: teamID,
		})
		if err != nil {
			return res, err
		}
		vis := chat1.TLFVisibility_PRIVATE
		if public {
			vis = chat1.TLFVisibility_PUBLIC
		}
		return teamToNameInfo(ctx, team, vis)
	default:
		return k.Find(ctx, tlfName, membersType, public)
	}
}

// Ignores tlfName or teamID based on membersType.
func (k *KeyFinderImpl) FindForDecryption(ctx context.Context,
	tlfName string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int) (res types.NameInfo, err error) {

	switch membersType {
	case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAM:
		teamID, err := tlfIDToTeamdID(teamID)
		if err != nil {
			return res, err
		}
		team, err := teams.Load(ctx, k.G().ExternalG(), keybase1.LoadTeamArg{
			ID: teamID,
			Refreshers: keybase1.TeamRefreshers{
				NeedKeyGeneration: keybase1.PerTeamKeyGeneration(keyGeneration),
			},
			StaleOK: true,
		})
		if err != nil {
			return res, err
		}
		vis := chat1.TLFVisibility_PRIVATE
		if public {
			vis = chat1.TLFVisibility_PUBLIC
		}
		return teamToNameInfo(ctx, team, vis)
	default:
		return k.Find(ctx, tlfName, membersType, public)
	}
}

func (k *KeyFinderImpl) SetNameInfoSourceOverride(ni types.NameInfoSource) {
	k.testingNameInfoSource = ni
}

func tlfIDToTeamdID(tlfID chat1.TLFID) (keybase1.TeamID, error) {
	return keybase1.TeamIDFromString(tlfID.String())
}

func teamIDToTLFID(teamID keybase1.TeamID) (chat1.TLFID, error) {
	return chat1.MakeTLFID(teamID.String())
}
