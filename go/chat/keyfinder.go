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
	keys map[string]keybase1.GetTLFCryptKeysRes
}

// newKeyFinder creates a keyFinder.
func NewKeyFinder() *KeyFinder {
	return &KeyFinder{keys: make(map[string]keybase1.GetTLFCryptKeysRes)}
}

func (k *KeyFinder) cacheKey(tlfName string, tlfPublic bool) string {
	return fmt.Sprintf("%s|%v", tlfName, tlfPublic)
}

// find finds keybase1.TLFCryptKeys for tlfName, checking for existing
// results.
func (k *KeyFinder) Find(ctx context.Context, tlf keybase1.TlfInterface, tlfName string, tlfPublic bool) (keybase1.GetTLFCryptKeysRes, error) {
	ckey := k.cacheKey(tlfName, tlfPublic)
	existing, ok := k.keys[ckey]
	if ok {
		return existing, nil
	}

	query := keybase1.TLFQuery{
		TlfName:          tlfName,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
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

	k.keys[ckey] = keys

	return keys, nil
}
