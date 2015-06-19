package libkb

import (
	"encoding/hex"
	"math/rand"
	"sync"
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
)

func TestConcurrentUserCache(t *testing.T) {
	uc, err := NewUserCache(10000)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			for j := 0; j < 100; j++ {
				uid := UsernameToUID(randomString())
				u := &User{id: uid}
				// nlock doesn't really matter in this situation, but
				// code using usercache holds it during Put(), so
				// putting it here too.
				nlock := uc.LockUID(uid.String())
				uc.Put(u)
				nlock.Unlock()
			}
			wg.Done()
		}()
		wg.Add(1)
		go func() {
			for j := 0; j < 100; j++ {
				x, err := RandBytes(keybase1.UID_LEN)
				if err != nil {
					t.Fatal(err)
				}
				u, _ := keybase1.UIDFromString(hex.EncodeToString(x))
				// nlock doesn't really matter, but code using
				// usercache holds it during Get(), so putting it here too.
				nlock := uc.LockUID(u.String())
				uc.Get(u)
				nlock.Unlock()
			}
			wg.Done()
		}()
	}

	wg.Wait()
}

// just for testing
func randomString() string {
	numChars := rand.Intn(50)
	codePoints := make([]rune, numChars)
	for i := 0; i < numChars; i++ {
		codePoints[i] = rune(rand.Intn(0x10ffff))
	}
	return string(codePoints)
}
