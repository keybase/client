package chat

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type encItem struct {
	key types.CryptKey
	ni  types.NameInfo
}

// KeyFinder remembers results from previous calls to CryptKeys().
type KeyFinderImpl struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	keys    map[string]*types.NameInfo
	decKeys map[string]types.CryptKey
	encKeys map[string]encItem
}

// NewKeyFinder creates a KeyFinder.
func NewKeyFinder(g *globals.Context) types.KeyFinder {
	return &KeyFinderImpl{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "KeyFinder", false),
		keys:         make(map[string]*types.NameInfo),
		decKeys:      make(map[string]types.CryptKey),
		encKeys:      make(map[string]encItem),
	}
}

func (k *KeyFinderImpl) Reset() {
	k.keys = make(map[string]*types.NameInfo)
	k.decKeys = make(map[string]types.CryptKey)
	k.encKeys = make(map[string]encItem)
}

func (k *KeyFinderImpl) cacheKey(name string, membersType chat1.ConversationMembersType, public bool) string {
	return fmt.Sprintf("%s|%v|%v", name, membersType, public)
}

func (k *KeyFinderImpl) encCacheKey(name string, tlfID chat1.TLFID, membersType chat1.ConversationMembersType,
	public bool) string {
	return fmt.Sprintf("_enc:%s|%s|%v|%v", name, tlfID, membersType, public)
}

func (k *KeyFinderImpl) decCacheKey(name string, tlfID chat1.TLFID, membersType chat1.ConversationMembersType,
	generation int, public bool, kbfsEncrypted bool) string {
	return fmt.Sprintf("_dec:%s|%s|%v|%v|%v|%d", name, tlfID, membersType, public, kbfsEncrypted, generation)
}

func (k *KeyFinderImpl) createNameInfoSource(ctx context.Context,
	membersType chat1.ConversationMembersType) types.NameInfoSource {
	return CreateNameInfoSource(ctx, k.G(), membersType)
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

func (k *KeyFinderImpl) lookupEncKey(key string) (encItem, bool) {
	k.Lock()
	defer k.Unlock()
	existing, ok := k.encKeys[key]
	return existing, ok
}

func (k *KeyFinderImpl) writeEncKey(key string, v encItem) {
	k.Lock()
	defer k.Unlock()
	k.encKeys[key] = v
}

func (k *KeyFinderImpl) lookupDecKey(key string) (types.CryptKey, bool) {
	k.Lock()
	defer k.Unlock()
	existing, ok := k.decKeys[key]
	return existing, ok
}

func (k *KeyFinderImpl) writeDecKey(key string, v types.CryptKey) {
	k.Lock()
	defer k.Unlock()
	k.decKeys[key] = v
}

// FindForEncryption finds keys up-to-date enough for encrypting.
// Ignores tlfName or teamID based on membersType.
func (k *KeyFinderImpl) FindForEncryption(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (res types.CryptKey, ni types.NameInfo, err error) {

	ckey := k.encCacheKey(tlfName, tlfID, membersType, public)
	existing, ok := k.lookupEncKey(ckey)
	if ok {
		return existing.key, existing.ni, nil
	}
	defer func() {
		if err == nil {
			k.writeEncKey(ckey, encItem{
				key: res,
				ni:  ni,
			})
		}
	}()

	return k.createNameInfoSource(ctx, membersType).EncryptionKey(ctx, tlfName, tlfID,
		membersType, public)
}

// FindForDecryption ignores tlfName or teamID based on membersType.
func (k *KeyFinderImpl) FindForDecryption(ctx context.Context,
	tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (res types.CryptKey, err error) {
	ckey := k.decCacheKey(tlfName, tlfID, membersType, keyGeneration, public, kbfsEncrypted)
	existing, ok := k.lookupDecKey(ckey)
	if ok {
		return existing, nil
	}
	defer func() {
		if err == nil {
			k.writeDecKey(ckey, res)
		}
	}()
	return k.createNameInfoSource(ctx, membersType).DecryptionKey(ctx, tlfName, tlfID,
		membersType, public, keyGeneration, kbfsEncrypted)
}

func (k *KeyFinderImpl) EphemeralKeyForEncryption(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (ek keybase1.TeamEk, err error) {
	return k.createNameInfoSource(mctx.Ctx(), membersType).EphemeralEncryptionKey(
		mctx, tlfName, tlfID, membersType, public)
}

func (k *KeyFinderImpl) EphemeralKeyForDecryption(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	generation keybase1.EkGeneration, contentCtime *gregor1.Time) (keybase1.TeamEk, error) {
	return k.createNameInfoSource(mctx.Ctx(), membersType).EphemeralDecryptionKey(
		mctx, tlfName, tlfID, membersType, public, generation, contentCtime)
}

func (k *KeyFinderImpl) ShouldPairwiseMAC(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error) {
	return k.createNameInfoSource(ctx, membersType).ShouldPairwiseMAC(ctx, tlfName, tlfID, membersType, public)
}

func tlfIDToTeamdID(tlfID chat1.TLFID) (keybase1.TeamID, error) {
	return keybase1.TeamIDFromString(tlfID.String())
}

type KeyFinderMock struct {
	cryptKeys []keybase1.CryptKey
}

var _ types.KeyFinder = (*KeyFinderMock)(nil)

func NewKeyFinderMock(cryptKeys []keybase1.CryptKey) types.KeyFinder {
	return &KeyFinderMock{cryptKeys}
}

func (k *KeyFinderMock) Reset() {}

func (k *KeyFinderMock) FindForEncryption(ctx context.Context,
	tlfName string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (res types.CryptKey, ni types.NameInfo, err error) {
	return k.cryptKeys[len(k.cryptKeys)-1], ni, nil
}

func (k *KeyFinderMock) FindForDecryption(ctx context.Context,
	tlfName string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (res types.CryptKey, err error) {
	for _, key := range k.cryptKeys {
		if key.Generation() == keyGeneration {
			return key, nil
		}
	}
	return res, NewDecryptionKeyNotFoundError(keyGeneration, public, kbfsEncrypted)
}

func (k *KeyFinderMock) EphemeralKeyForEncryption(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (keybase1.TeamEk, error) {
	panic("unimplemented")
}

func (k *KeyFinderMock) EphemeralKeyForDecryption(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	generation keybase1.EkGeneration, contentCtime *gregor1.Time) (keybase1.TeamEk, error) {
	panic("unimplemented")
}

func (k *KeyFinderMock) ShouldPairwiseMAC(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error) {
	panic("unimplemented")
}

func (k *KeyFinderMock) SetNameInfoSourceOverride(ni types.NameInfoSource) {}
