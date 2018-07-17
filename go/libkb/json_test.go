package libkb

import (
	"sync"
	"testing"
)

func TestJsonTransaction(t *testing.T) {
	tc := SetupTest(t, "json", 1)
	defer tc.Cleanup()

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			tx, err := tc.G.Env.GetConfigWriter().BeginTransaction()
			if err == nil {
				tx.Abort()
			}
			wg.Done()
		}()
	}
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			tx, err := tc.G.Env.GetConfigWriter().BeginTransaction()
			if err == nil {
				tx.Commit()
			}
			wg.Done()
		}()
	}
	wg.Wait()
}
