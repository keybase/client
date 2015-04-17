package engine

import (
	"fmt"
	"sync"
	"testing"
)

// TestConcurrentLogin tries calling logout, login, and many of
// the exposed methods in LoginState concurrently.  It is mainly
// useful when used with the -race flag.
func TestConcurrentLogin(t *testing.T) {
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
					G.LoginState.Shutdown()
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
