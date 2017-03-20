package chat

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
)

// KeyFinder remembers results from previous calls to CryptKeys().
type KeyFinder interface {
	Find(ctx context.Context, tlf *TLFInfoSource, tlfName string, tlfPublic bool) (keybase1.GetTLFCryptKeysRes, error)
}

type KeyFinderImpl struct {
	sync.Mutex
	keys map[string]keybase1.GetTLFCryptKeysRes
}

// NewKeyFinder creates a KeyFinder.
func NewKeyFinder() KeyFinder {
	return &KeyFinderImpl{
		keys: make(map[string]keybase1.GetTLFCryptKeysRes),
	}
}

func (k *KeyFinderImpl) cacheKey(tlfName string, tlfPublic bool) string {
	return fmt.Sprintf("%s|%v", tlfName, tlfPublic)
}

// Find finds keybase1.TLFCryptKeys for tlfName, checking for existing
// results.
func (k *KeyFinderImpl) Find(ctx context.Context, tlf *TLFInfoSource, tlfName string, tlfPublic bool) (keybase1.GetTLFCryptKeysRes, error) {

	ckey := k.cacheKey(tlfName, tlfPublic)
	k.Lock()
	existing, ok := k.keys[ckey]
	k.Unlock()
	if ok {
		return existing, nil
	}

	var keys keybase1.GetTLFCryptKeysRes
	if tlfPublic {
		res, err := tlf.PublicCanonicalTLFNameAndID(ctx, tlfName, keybase1.TLFIdentifyBehavior_CHAT_CLI)
		if err != nil {
			return keybase1.GetTLFCryptKeysRes{}, err
		}
		keys.NameIDBreaks = res
		keys.CryptKeys = []keybase1.CryptKey{publicCryptKey}
	} else {
		var err error
		keys, err = tlf.CryptKeys(ctx, tlfName, keybase1.TLFIdentifyBehavior_CHAT_CLI)
		if err != nil {
			return keybase1.GetTLFCryptKeysRes{}, err
		}
	}

	k.Lock()
	k.keys[ckey] = keys
	k.Unlock()

	return keys, nil
}
