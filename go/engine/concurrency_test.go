// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"flag"
	"fmt"
	"math/rand"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
)

var runConc = flag.Bool("conc", false, "run (expensive) concurrency tests")

// TestConcurrentLogin tries calling logout, login, and many of
// the exposed methods in LoginState concurrently.  Use the
// -race flag to test it.
func TestConcurrentLogin(t *testing.T) {
	if !*runConc {
		t.Skip("Skipping ConcurrentLogin test")
	}
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	var lwg sync.WaitGroup
	var mwg sync.WaitGroup

	done := make(chan bool)

	for i := 0; i < 10; i++ {
		lwg.Add(1)
		go func(index int) {
			defer lwg.Done()
			for j := 0; j < 4; j++ {
				Logout(tc)
				u.Login(tc.G)
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
					tc.G.LoginState().LocalSession(func(s *libkb.Session) {
						s.APIArgs()
					}, "APIArgs")
					tc.G.LoginState().Account(func(a *libkb.Account) {
						a.UserInfo()
					}, "UserInfo")
					tc.G.LoginState().LocalSession(func(s *libkb.Session) {
						s.GetUID()
					}, "GetUID")
					tc.G.LoginState().LocalSession(func(s *libkb.Session) {
						s.Load()
					}, "session Load")
					tc.G.LoginState().LoggedIn()
					tc.G.LoginState().LoggedInLoad()
					// tc.G.LoginState.Shutdown()
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
	if !*runConc {
		t.Skip("Skipping ConcurrentGetPassphraseStream test")
	}
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	var lwg sync.WaitGroup
	var mwg sync.WaitGroup

	done := make(chan bool)

	for i := 0; i < 10; i++ {
		lwg.Add(1)
		go func(index int) {
			defer lwg.Done()
			for j := 0; j < 4; j++ {
				Logout(tc)
				u.Login(tc.G)
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
					_, err := tc.G.LoginState().GetPassphraseStream(u.NewSecretUI())
					if err != nil {
						tc.G.Log.Warning("GetPassphraseStream err: %s", err)
					}
				}
			}
		}(i)
	}

	lwg.Wait()
	close(done)
	mwg.Wait()
}

// TestConcurrentLogin tries calling logout, login, and many of
// the exposed methods in LoginState concurrently.  Use the
// -race flag to test it.
func TestConcurrentSignup(t *testing.T) {
	if !*runConc {
		t.Skip("Skipping ConcurrentSignup test")
	}
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	var lwg sync.WaitGroup
	var mwg sync.WaitGroup

	done := make(chan bool)

	for i := 0; i < 10; i++ {
		lwg.Add(1)
		go func(index int) {
			defer lwg.Done()
			for j := 0; j < 4; j++ {
				Logout(tc)
				u.Login(tc.G)
				Logout(tc)
			}
			fmt.Printf("logout/login #%d done\n", index)
		}(i)

		mwg.Add(1)
		go func(index int) {
			defer mwg.Done()
			CreateAndSignupFakeUserSafe(tc.G, "login")
			Logout(tc)
			fmt.Printf("func caller %d done\n", index)
		}(i)
	}

	lwg.Wait()
	close(done)
	mwg.Wait()
}

// TestConcurrentGlobals tries to find race conditions in
// everything in GlobalContext.
func TestConcurrentGlobals(t *testing.T) {
	if !*runConc {
		t.Skip("Skipping ConcurrentGlobals")
	}
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	fns := []func(*libkb.GlobalContext){
		genv,
	}
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(index int) {
			for j := 0; j < 10; j++ {
				f := fns[rand.Intn(len(fns))]
				f(tc.G)
			}
			wg.Done()
		}(i)
	}
	wg.Wait()
}

func genv(g *libkb.GlobalContext) {
	g.Env.GetConfig()
	g.Env.GetConfigWriter()
	g.Env.GetCommandLine()
	cf := libkb.NewJSONConfigFile(g, "")
	g.Env.SetConfig(*cf, cf)
}

func gkeyring() {

}
