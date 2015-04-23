package libkb

import (
	"math/rand"
	"sync"
	"testing"
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
				nlock := uc.LockUID(uid.String())
				uc.Put(u)
				nlock.Unlock()
			}
			wg.Done()
		}()
		wg.Add(1)
		go func() {
			for j := 0; j < 100; j++ {
				x, err := RandBytes(UID_LEN)
				var u UID
				copy(u[:], x)
				if err != nil {
					t.Fatal(err)
				}
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
