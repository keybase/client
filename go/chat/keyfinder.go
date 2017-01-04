package chat

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// KeyFinder remembers results from previous calls to CryptKeys().
type KeyFinder interface {
	Find(ctx context.Context, tlf keybase1.TlfInterface, tlfName string, tlfPublic bool) (keybase1.GetTLFCryptKeysRes, error)
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
func (k *KeyFinderImpl) Find(ctx context.Context, tlf keybase1.TlfInterface, tlfName string, tlfPublic bool) (keybase1.GetTLFCryptKeysRes, error) {

	k.Lock()
	ckey := k.cacheKey(tlfName, tlfPublic)
	existing, ok := k.keys[ckey]
	if ok {
		defer k.Unlock()
		return existing, nil
	}
	k.Unlock()

	query := keybase1.TLFQuery{
		TlfName: tlfName,
	}
	var keys keybase1.GetTLFCryptKeysRes
	if tlfPublic {
		res, err := tlf.PublicCanonicalTLFNameAndID(ctx, query)
		if err != nil {
			return keybase1.GetTLFCryptKeysRes{}, err
		}
		keys.NameIDBreaks = res
		keys.CryptKeys = []keybase1.CryptKey{publicCryptKey}
	} else {
		var err error
		keys, err = tlf.CryptKeys(ctx, query)
		if err != nil {
			return keybase1.GetTLFCryptKeysRes{}, err
		}
	}

	k.Lock()
	defer k.Unlock()
	k.keys[ckey] = keys

	return keys, nil
}
