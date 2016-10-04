package chat

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
)

// keyFinder remembers results from previous calls to CryptKeys().
// It is not intended to be used by multiple concurrent goroutines
// or held onto for very long, just to remember the keys while
// unboxing a thread of messages.
type KeyFinder struct {
	keys map[string]keybase1.TLFCryptKeys
}

// newKeyFinder creates a keyFinder.
func NewKeyFinder() *KeyFinder {
	return &KeyFinder{keys: make(map[string]keybase1.TLFCryptKeys)}
}

func (k *KeyFinder) cacheKey(tlfName string, tlfPublic bool) string {
	return fmt.Sprintf("%s|%v", tlfName, tlfPublic)
}

// find finds keybase1.TLFCryptKeys for tlfName, checking for existing
// results.
func (k *KeyFinder) Find(ctx context.Context, tlf keybase1.TlfInterface, tlfName string, tlfPublic bool) (keybase1.TLFCryptKeys, error) {
	ckey := k.cacheKey(tlfName, tlfPublic)
	existing, ok := k.keys[ckey]
	if ok {
		return existing, nil
	}

	var keys keybase1.TLFCryptKeys
	if tlfPublic {
		cid, err := tlf.PublicCanonicalTLFNameAndID(ctx, tlfName)
		if err != nil {
			return keybase1.TLFCryptKeys{}, err
		}
		keys.CanonicalName = cid.CanonicalName
		keys.TlfID = cid.TlfID
		keys.CryptKeys = []keybase1.CryptKey{publicCryptKey}
	} else {
		var err error
		keys, err = tlf.CryptKeys(ctx, tlfName)
		if err != nil {
			return keybase1.TLFCryptKeys{}, err
		}
	}

	k.keys[ckey] = keys

	return keys, nil
}
