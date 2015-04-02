package libkb

import "os"

// TrapKeypress is designed to read stdin, looking for Ctrl-C or
// Ctrl-D.  When it receives either, it will shut down the client.
// To use it, do this:
//
// func x() {
//	done := make(chan bool)
//	defer close(done)
//	go libkb.TrapKeypress(done)
//	// do something that takes a long time and doesn't prompt
//	// the user for anything
// }
//
// When the function exits, TrapKeypress will stop.  It will
// consume one more byte from stdin, however, as there is no way
// to cancel the pending read.
//
// This is only necessary when there is a long-running command
// that doesn't use the ui to prompt the user.  For example,
// logging in on a new device while it is waiting for the `sibkey
// add` command to run on an existing device.
func TrapKeypress(done chan bool) {
	keys := make(chan byte)
	go func() {
		buf := make([]byte, 1)
		for {
			_, err := os.Stdin.Read(buf)
			if err != nil {
				G.Log.Debug("stdin read error: %s", err)
				return
			}
			select {
			case keys <- buf[0]:
			case <-done:
				G.Log.Debug("TrapKeypress read goroutine stopping due to closed done chan")
				return
			}
		}
	}()

	for {
		select {
		case k := <-keys:
			if k == 3 || k == 4 {
				// ctrl-c or ctrl-d pressed
				G.Log.Debug("TrapKeypress trapped ctrl-c or ctrl-d")
				G.Shutdown()
				G.Log.Error("interrupted")
				os.Exit(3)
			}
		case <-done:
			G.Log.Debug("TrapKeypress received on done chan, exiting")
			return
		}
	}
}
