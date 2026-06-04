package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/pvl"
	jsonw "github.com/keybase/go-jsonw"
)

/*

Example use (current working dir has to be `client/go`):

go run ./tools/pvlcheck \
	-kit ../pvl-tools/kit.json \
	-service reddit
	-api-url "https://www.reddit.com/r/KeybaseProofs/comments/2clf9c/my_keybase_proof_redditmaxtaco_keybasemax/.json"
	-response ~/Downloads/reddit-max.json \
	-kind json \
	-username max \
	-remote-username maxtaco \
	-sig "$(cat ~/Downloads/reddit-max-sig.pgp)"

*/

var (
	kitPath    = flag.String("kit", "", "path to a pvl kit.json (required)")
	respPath   = flag.String("response", "", "path to a saved service response file (required, unless service has no fetch e.g. coinbase)")
	kind       = flag.String("kind", "", "kind of the saved response: json | html | string (required when -response is set)")
	service    = flag.String("service", "", "service to run, e.g. twitter, github, reddit, facebook, hackernews, generic_web_site (required)")
	version    = flag.String("version", "1", "pvl version chunk to use from the kit's tab")
	apiURL     = flag.String("api-url", "", "value of the hint_url register (the proof's API url)")
	sig        = flag.String("sig", "", "armored signature for the proof")
	username   = flag.String("username", "kronk", "keybase username")
	remoteUser = flag.String("remote-username", "kronkinator", "remote (service) username")
	hostname   = flag.String("hostname", "", "hostname (for dns / generic_web_site proofs)")
	protocol   = flag.String("protocol", "https:", "protocol (for generic_web_site proofs)")
	debugLogs  = flag.Bool("debug", false, "print the interpreter's per-instruction debug trace")
)

func die(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

// fakeXAPI implements libkb.ExternalAPI by returning a single canned response
// from a file, regardless of which endpoint the script fetches.
type fakeXAPI struct {
	kind libkb.XAPIResType
	json *libkb.ExternalAPIRes
	html *libkb.ExternalHTMLRes
	text *libkb.ExternalTextRes
}

func (e *fakeXAPI) Get(m libkb.MetaContext, arg libkb.APIArg) (*libkb.ExternalAPIRes, error) {
	if e.kind != libkb.XAPIResJSON {
		return nil, fmt.Errorf("script fetched json but -kind is %v (endpoint %v)", *kind, arg.Endpoint)
	}
	fmt.Fprintf(os.Stderr, "Returning fake JSON response for: %q\n", arg.Endpoint)
	return e.json, nil
}

func (e *fakeXAPI) GetHTML(m libkb.MetaContext, arg libkb.APIArg) (*libkb.ExternalHTMLRes, error) {
	if e.kind != libkb.XAPIResHTML {
		return nil, fmt.Errorf("script fetched html but -kind is %v (endpoint %v)", *kind, arg.Endpoint)
	}
	fmt.Fprintf(os.Stderr, "Returning fake HTML response for: %q\n", arg.Endpoint)
	return e.html, nil
}

func (e *fakeXAPI) GetText(m libkb.MetaContext, arg libkb.APIArg) (*libkb.ExternalTextRes, error) {
	if e.kind != libkb.XAPIResText {
		return nil, fmt.Errorf("script fetched string but -kind is %v (endpoint %v)", *kind, arg.Endpoint)
	}
	fmt.Fprintf(os.Stderr, "Returning fake text response for: %q\n", arg.Endpoint)
	return e.text, nil
}

func (e *fakeXAPI) Post(m libkb.MetaContext, arg libkb.APIArg) (*libkb.ExternalAPIRes, error) {
	return nil, fmt.Errorf("pvlcheck: Post is not supported")
}

func (e *fakeXAPI) PostHTML(m libkb.MetaContext, arg libkb.APIArg) (*libkb.ExternalHTMLRes, error) {
	return nil, fmt.Errorf("pvlcheck: PostHTML is not supported")
}

// extractChunk pulls tab[version] out of a kit.json file and returns it as a
// JSON string, which is what pvl.CheckProof expects.
func extractChunk(path, version string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		die("could not read kit %q: %v", path, err)
	}
	var kit struct {
		Tab map[string]json.RawMessage `json:"tab"`
	}
	if err := json.Unmarshal(data, &kit); err != nil {
		die("could not parse kit json: %v", err)
	}
	chunk, ok := kit.Tab[version]
	if !ok {
		var have []string
		for k := range kit.Tab {
			have = append(have, k)
		}
		die("kit has no tab[%q] (available: %s)", version, strings.Join(have, ", "))
	}
	return string(chunk)
}

func buildFakeXAPI() *fakeXAPI {
	if *respPath == "" {
		// No fetch needed (e.g. coinbase, which fails before fetching).
		return &fakeXAPI{}
	}
	data, err := os.ReadFile(*respPath)
	if err != nil {
		die("could not read response %q: %v", *respPath, err)
	}
	switch *kind {
	case "json":
		w, err := jsonw.Unmarshal(data)
		if err != nil {
			die("response is not valid json: %v", err)
		}
		return &fakeXAPI{kind: libkb.XAPIResJSON, json: &libkb.ExternalAPIRes{HTTPStatus: 200, Body: w}}
	case "html":
		doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(data)))
		if err != nil {
			die("could not parse html response: %v", err)
		}
		return &fakeXAPI{kind: libkb.XAPIResHTML, html: &libkb.ExternalHTMLRes{HTTPStatus: 200, GoQuery: doc}}
	case "string", "text":
		return &fakeXAPI{kind: libkb.XAPIResText, text: &libkb.ExternalTextRes{HTTPStatus: 200, Body: string(data)}}
	default:
		die("invalid -kind %q; want json | html | string", *kind)
		return nil
	}
}

func main() {
	flag.Parse()

	if *kitPath == "" {
		die("missing required -kit")
	}
	if *service == "" {
		die("missing required -service")
	}
	if *respPath == "" {
		die("missing required -response")
	}
	if *sig == "" {
		die("missing required -sig")
	}
	if *kind == "" {
		die("missing required -kind")
	}

	svc, ok := keybase1.ProofTypeMap[strings.ToUpper(*service)]
	if !ok {
		die("unknown service %q", *service)
	}
	if svc == keybase1.ProofType_DNS {
		die("dns proofs are not supported by pvlcheck (the dns stub is internal to the pvl package)")
	}

	chunk := extractChunk(*kitPath, *version)

	g := libkb.NewGlobalContext().Init()
	xapi := buildFakeXAPI()
	g.Log = logger.New("pvlcheck")
	if *debugLogs {
		g.Log.Configure("", true, "")
	}
	if err := g.ConfigureCaches(); err != nil {
		die("could not configure caches: %v", err)
	}
	g.XAPI = xapi

	info := pvl.ProofInfo{
		ArmoredSig:     *sig,
		Username:       *username,
		RemoteUsername: *remoteUser,
		Hostname:       *hostname,
		Protocol:       *protocol,
		APIURL:         *apiURL,
	}

	m := libkb.NewMetaContextBackground(g)
	perr := pvl.CheckProof(m, chunk, svc, info)
	if perr != nil {
		fmt.Printf("FAIL: [%v] %v\n", perr.GetProofStatus(), perr.GetDesc())
		os.Exit(2)
	}
	fmt.Printf("PASS: %v proof verified\n", *service)
}
