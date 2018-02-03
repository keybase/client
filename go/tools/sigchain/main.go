package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"runtime"
	"runtime/pprof"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	jsonw "github.com/keybase/go-jsonw"
)

func errout(msg string) {
	fmt.Fprintf(os.Stderr, msg+"\n")
	os.Exit(1)
}

func read() []byte {
	var in io.Reader
	switch flag.NArg() {
	case 0:
		fmt.Println("reading sigchain from stdin")
		in = os.Stdin
	case 1:
		fmt.Printf("reading sigchain from %q\n", flag.Arg(0))
		f, err := os.Open(flag.Arg(0))
		if err != nil {
			errout(err.Error())
		}
		defer f.Close()
		in = f
	default:
		errout("provide 0 or 1 args")
	}

	all, err := ioutil.ReadAll(in)
	if err != nil {
		errout(err.Error())
	}
	fmt.Printf("%d bytes read\n", len(all))
	return all
}

func memstats() {
	runtime.GC()
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	fmt.Printf("Alloc: %d (%d KB) (%d MB)\n", ms.Alloc, ms.Alloc/1024, ms.Alloc/(1024*1024))
	fmt.Printf("TotalAlloc: %d (%d KB) (%d MB)\n", ms.TotalAlloc, ms.TotalAlloc/1024, ms.TotalAlloc/(1024*1024))
}

func memprof() {
	f, err := os.Create("/tmp/sc_memprof")
	if err != nil {
		log.Fatal("could not create memory profile: ", err)
	}
	runtime.GC() // get up-to-date statistics
	if err := pprof.WriteHeapProfile(f); err != nil {
		log.Fatal("could not write memory profile: ", err)
	}
	f.Close()
	fmt.Printf("wrote memory profile to /tmp/sc_memprof\n")
}

// don't GC me
var sc *libkb.SigChain

func main() {
	fmt.Println("sigchain loader")
	flag.Parse()
	raw := read()

	jw, err := jsonw.Unmarshal(raw)
	if err != nil {
		errout(err.Error())
	}

	g := libkb.NewGlobalContext().Init()
	g.Log = logger.New("sc")
	g.ConfigureCaches()

	sc = &libkb.SigChain{Contextified: libkb.NewContextified(g)}
	sc.SetUIDUsername("2c7529821178c708bf6dd6bbb5c6b500", "chip")
	_, err = sc.LoadServerBody(context.Background(), jw, 0, nil, "")
	if err != nil {
		errout(err.Error())
	}

	if err = sc.VerifyChain(context.Background()); err != nil {
		errout(err.Error())
	}

	memstats()
	memprof()
}
