package chat

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// KeyFinder remembers results from previous calls to CryptKeys().
type KeyFinder interface {
	Find(ctx context.Context, name string, membersType chat1.ConversationMembersType, public bool) (*types.NameInfo, error)
	FindForEncryption(ctx context.Context, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool) (*types.NameInfo, error)
	FindForDecryption(ctx context.Context, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, keyGeneration int,
		kbfsEncrypted bool) (*types.NameInfo, error)
	EphemeralKeyForEncryption(ctx context.Context, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool) (keybase1.TeamEk, error)
	EphemeralKeyForDecryption(ctx context.Context, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, generation keybase1.EkGeneration) (keybase1.TeamEk, error)
	Reset()
	SetNameInfoSourceOverride(types.NameInfoSource)
}

type KeyFinderImpl struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	keys map[string]*types.NameInfo

	// Testing
	testingNameInfoSource types.NameInfoSource
}

// NewKeyFinder creates a KeyFinder.
func NewKeyFinder(g *globals.Context) KeyFinder {
	return &KeyFinderImpl{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "KeyFinder", false),
		keys:         make(map[string]*types.NameInfo),
	}
}

func (k *KeyFinderImpl) Reset() {
	k.keys = make(map[string]*types.NameInfo)
}

func (k *KeyFinderImpl) cacheKey(name string, membersType chat1.ConversationMembersType, public bool) string {
	return fmt.Sprintf("%s|%v|%v", name, membersType, public)
}

func (k *KeyFinderImpl) encCacheKey(name string, tlfID chat1.TLFID, membersType chat1.ConversationMembersType,
	public bool) string {
	return fmt.Sprintf("_enc:%s|%s|%v|%v", name, tlfID, membersType, public)
}

func (k *KeyFinderImpl) decCacheKey(name string, tlfID chat1.TLFID, membersType chat1.ConversationMembersType,
	public bool, kbfsEncrypted bool) string {
	return fmt.Sprintf("_dec:%s|%s|%v|%v|%v", name, tlfID, membersType, public, kbfsEncrypted)
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
	case chat1.ConversationMembersType_IMPTEAMNATIVE:
		return NewImplicitTeamsNameInfoSource(k.G(), false)
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		return NewImplicitTeamsNameInfoSource(k.G(), true)
	}
	k.Debug(ctx, "createNameInfoSource: unknown members type, using KBFS: %v", membersType)
	return NewKBFSNameInfoSource(k.G())
}

func (k *KeyFinderImpl) lookupKey(key string) (*types.NameInfo, bool) {
	k.Lock()
	defer k.Unlock()
	existing, ok := k.keys[key]
	return existing, ok
}

func (k *KeyFinderImpl) writeKey(key string, v *types.NameInfo) {
	k.Lock()
	defer k.Unlock()
	k.keys[key] = v
}

// Find finds keybase1.TLFCryptKeys for tlfName, checking for existing
// results.
func (k *KeyFinderImpl) Find(ctx context.Context, name string,
	membersType chat1.ConversationMembersType, public bool) (res *types.NameInfo, err error) {

	ckey := k.cacheKey(name, membersType, public)
	existing, ok := k.lookupKey(ckey)
	if ok {
		return existing, nil
	}
	defer func() {
		if err == nil {
			k.writeKey(ckey, res)
		}
	}()

	res, err = k.createNameInfoSource(ctx, membersType).Lookup(ctx, name, public)
	if err != nil {
		return nil, err
	}
	if public {
		res.CryptKeys[membersType] = append(res.CryptKeys[membersType], publicCryptKey)
	}
	return res, nil
}

// FindForEncryption finds keys up-to-date enough for encrypting.
// Ignores tlfName or teamID based on membersType.
func (k *KeyFinderImpl) FindForEncryption(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (res *types.NameInfo, err error) {

	ckey := k.encCacheKey(tlfName, tlfID, membersType, public)
	existing, ok := k.lookupKey(ckey)
	if ok {
		return existing, nil
	}
	defer func() {
		if err == nil {
			k.writeKey(ckey, res)
		}
	}()

	if res, err = k.createNameInfoSource(ctx, membersType).EncryptionKeys(ctx, tlfName, tlfID,
		membersType, public); err != nil {
		return nil, err
	}
	if public {
		res.CryptKeys[membersType] = append(res.CryptKeys[membersType], publicCryptKey)
	}
	return res, nil
}

// FindForDecryption ignores tlfName or teamID based on membersType.
func (k *KeyFinderImpl) FindForDecryption(ctx context.Context,
	tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (res *types.NameInfo, err error) {

	ckey := k.decCacheKey(tlfName, tlfID, membersType, public, kbfsEncrypted)
	existing, ok := k.lookupKey(ckey)
	if ok {
		effectiveMt := membersType
		if kbfsEncrypted {
			effectiveMt = chat1.ConversationMembersType_KBFS
		}
		storedKeys := existing.CryptKeys[effectiveMt]
		if len(storedKeys) > 0 && storedKeys[len(storedKeys)-1].Generation() >= keyGeneration {
			return existing, nil
		}
	}
	defer func() {
		if err == nil {
			k.writeKey(ckey, res)
		}
	}()

	if res, err = k.createNameInfoSource(ctx, membersType).DecryptionKeys(ctx, tlfName, tlfID,
		membersType, public, keyGeneration, kbfsEncrypted); err != nil {
		return nil, err
	}
	if public {
		res.CryptKeys[membersType] = append(res.CryptKeys[membersType], publicCryptKey)
	}
	return res, nil
}

func (k *KeyFinderImpl) EphemeralKeyForEncryption(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (ek keybase1.TeamEk, err error) {
	return k.createNameInfoSource(ctx, membersType).EphemeralEncryptionKey(ctx, tlfName, tlfID, membersType, public)
}

func (k *KeyFinderImpl) EphemeralKeyForDecryption(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, generation keybase1.EkGeneration) (keybase1.TeamEk, error) {
	return k.createNameInfoSource(ctx, membersType).EphemeralDecryptionKey(ctx, tlfName, tlfID, membersType, public, generation)
}

func (k *KeyFinderImpl) SetNameInfoSourceOverride(ni types.NameInfoSource) {
	k.testingNameInfoSource = ni
}

func tlfIDToTeamdID(tlfID chat1.TLFID) (keybase1.TeamID, error) {
	return keybase1.TeamIDFromString(tlfID.String())
}
