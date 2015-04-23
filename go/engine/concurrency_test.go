package engine

import (
	"fmt"
	"math/rand"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
)

// TestConcurrentLogin tries calling logout, login, and many of
// the exposed methods in LoginState concurrently.  Use the
// -race flag to test it.
func TestConcurrentLogin(t *testing.T) {
	// making it skip by default since it is slow...
	t.Skip("Skipping ConcurrentLogin test")
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")

	var lwg sync.WaitGroup
	var mwg sync.WaitGroup

	done := make(chan bool)

	for i := 0; i < 10; i++ {
		lwg.Add(1)
		go func(index int) {
			defer lwg.Done()
			for j := 0; j < 4; j++ {
				G.LoginState.Logout()
				u.LoginOrBust(t)
			}
			fmt.Printf("logout/login #%d done\n", index)
		}(i)

		mwg.Add(1)
		go func(index int) {
			defer mwg.Done()
			for {
				select {
				case <-done:
					fmt.Printf("func caller %d done\n", index)
					return
				default:
					G.LoginState.SessionArgs()
					G.LoginState.UserInfo()
					G.LoginState.UID()
					G.LoginState.SessionLoad()
					G.LoginState.IsLoggedIn()
					G.LoginState.IsLoggedInLoad()
					G.LoginState.AssertLoggedIn()
					G.LoginState.AssertLoggedOut()
					// G.LoginState.Shutdown()
					G.LoginState.GetCachedTriplesec()
					G.LoginState.GetCachedPassphraseStream()
				}
			}
		}(i)
	}

	lwg.Wait()
	close(done)
	mwg.Wait()
}

// TestConcurrentGetPassphraseStream tries calling logout, login,
// and GetPassphraseStream to check for race conditions.
// Use the -race flag to test it.
func TestConcurrentGetPassphraseStream(t *testing.T) {
	// making it skip by default since it is slow...
	t.Skip("Skipping ConcurrentGetPassphraseStream test")
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")

	var lwg sync.WaitGroup
	var mwg sync.WaitGroup

	done := make(chan bool)

	for i := 0; i < 10; i++ {
		lwg.Add(1)
		go func(index int) {
			defer lwg.Done()
			for j := 0; j < 4; j++ {
				G.LoginState.Logout()
				u.LoginOrBust(t)
			}
			fmt.Printf("logout/login #%d done\n", index)
		}(i)

		mwg.Add(1)
		go func(index int) {
			defer mwg.Done()
			for {
				select {
				case <-done:
					fmt.Printf("func caller %d done\n", index)
					return
				default:
					_, err := G.LoginState.GetPassphraseStream(u.NewSecretUI())
					if err != nil {
						G.Log.Warning("GetPassphraseStream err: %s", err)
					}
				}
			}
		}(i)
	}

	lwg.Wait()
	close(done)
	mwg.Wait()
}

// TestConcurrentGlobals tries to find race conditions in
// everything in GlobalContext.
func TestConcurrentGlobals(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	fns := []func(){
		genv,
	}
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(index int) {
			for j := 0; j < 10; j++ {
				f := fns[rand.Intn(len(fns))]
				f()
			}
			wg.Done()
		}(i)
	}
	wg.Wait()
}

func genv() {
	G.Env.GetConfig()
	G.Env.GetConfigWriter()
	G.Env.GetCommandLine()
	G.Env.SetConfig(libkb.NewJsonConfigFile(""))
	G.Env.SetConfigWriter(libkb.NewJsonConfigFile(""))
}

func gkeyring() {

}
