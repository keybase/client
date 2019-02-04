// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"bytes"
	b64 "encoding/base64"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"net"

	"github.com/PuerkitoBio/goquery"
	"github.com/keybase/client/go/jsonhelpers"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/miekg/dns"
)

// SupportedVersion is which version of PVL is supported by this client.
const SupportedVersion int = 1

// state of execution in a script
// copies of a scriptState will point to the same internal mutable data, so be careful
type scriptState struct {
	WhichScript int
	PC          int
	Service     keybase1.ProofType
	Regs        namedRegsStore
	Sig         []byte
	HasFetched  bool
	// nil until fetched
	FetchResult *fetchResult
}

type fetchResult struct {
	fetchMode fetchMode
	// One of these 3 must be filled.
	String string
	HTML   *goquery.Document
	JSON   *jsonw.Wrapper
}

type regexDescriptor struct {
	Template        string
	CaseInsensitive bool
	MultiLine       bool
}

type fetchMode string

const (
	fetchModeJSON   fetchMode = "json"
	fetchModeHTML   fetchMode = "html"
	fetchModeString fetchMode = "string"
	fetchModeDNS    fetchMode = "dns"
)

type commandName string

const (
	cmdAssertRegexMatch    commandName = "assert_regex_match"
	cmdAssertFindBase64    commandName = "assert_find_base64"
	cmdAssertCompare       commandName = "assert_compare"
	cmdWhitespaceNormalize commandName = "whitespace_normalize"
	cmdRegexCapture        commandName = "regex_capture"
	cmdReplaceAll          commandName = "replace_all"
	cmdParseURL            commandName = "parse_url"
	cmdFetch               commandName = "fetch"
	cmdParseHTML           commandName = "parse_html"
	cmdSelectorJSON        commandName = "selector_json"
	cmdSelectorCSS         commandName = "selector_css"
	cmdFill                commandName = "fill"
)

type stateMaker func(int) (scriptState, libkb.ProofError)

// ProofInfo contains all the data about a proof PVL needs to check it.
// It can be derived from a RemoteProofChainLink and SigHint.
type ProofInfo struct {
	ArmoredSig     string
	Username       string
	RemoteUsername string
	Hostname       string
	Protocol       string
	APIURL         string
	stubDNS        *stubDNSEngine
}

// NewProofInfo creates a new ProofInfo
func NewProofInfo(link libkb.RemoteProofChainLink, h libkb.SigHint) ProofInfo {
	return ProofInfo{
		ArmoredSig:     link.GetArmoredSig(),
		RemoteUsername: link.GetRemoteUsername(),
		Username:       link.GetUsername(),
		Hostname:       link.GetHostname(),
		Protocol:       link.GetProtocol(),
		APIURL:         h.GetAPIURL(),
	}
}

// CheckProof verifies one proof by running the pvl on the provided proof information.
func CheckProof(m libkb.MetaContext, pvlS string, service keybase1.ProofType, info ProofInfo) libkb.ProofError {
	m1 := newMetaContext(m, info.stubDNS)
	perr := checkProofInner(m1, pvlS, service, info)
	if perr != nil {
		debug(m1, "CheckProof failed: %v", perr)
	}
	if perr != nil && perr.GetProofStatus() == keybase1.ProofStatus_INVALID_PVL {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Invalid proof verification instructions! Let us know at https://github.com/keybase/keybase-issues/new")
	}
	return perr
}

func checkProofInner(m metaContext, pvlS string, service keybase1.ProofType, info ProofInfo) libkb.ProofError {
	pvl, err := parse(pvlS)
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not parse pvl: %v", err)
	}

	if perr := validateChunk(m, &pvl, service); perr != nil {
		return perr
	}

	sigBody, sigID, err := libkb.OpenSig(info.ArmoredSig)
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %v", err)
	}

	scripts, perr := chunkGetScripts(&pvl, service)
	if perr != nil {
		return perr
	}

	// validate hostname
	webish := (service == keybase1.ProofType_DNS || service == keybase1.ProofType_GENERIC_WEB_SITE)
	if webish {
		if !validateDomain(info.Hostname) {
			return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
				"Bad hostname in sig: %s", info.Hostname)
		}
	}

	// validate protocol
	if service == keybase1.ProofType_GENERIC_WEB_SITE {
		_, ok := validateProtocol(info.Protocol, []string{"http", "https"})
		if !ok {
			return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
				"Bad protocol in sig: %s", info.Protocol)
		}
	}

	mknewstate := func(i int) (scriptState, libkb.ProofError) {
		state := scriptState{
			WhichScript: i,
			PC:          0,
			Service:     service,
			Regs:        *newNamedRegsStore(),
			Sig:         sigBody,
			HasFetched:  false,
			FetchResult: nil,
		}

		err := setupRegs(m, &state.Regs, info, sigBody, sigID, service)
		return state, err
	}

	var errs []libkb.ProofError
	if service == keybase1.ProofType_DNS {
		if perr = runDNS(m, info.Hostname, scripts, mknewstate, sigID.ToMediumID()); perr != nil {
			errs = append(errs, perr)
		}
	} else {
		// Run the scripts in order.
		// If any succeed, the proof succeeds.
		// If one fails, the next takes over.
		// If all fail, log and report errors.
		for i, script := range scripts {
			state, perr := mknewstate(i)
			if perr != nil {
				return perr
			}
			perr = runScript(m, &script, state)
			if perr == nil {
				return nil
			}
			errs = append(errs, perr)
		}
	}

	if len(errs) == 0 {
		return nil
	} else if len(errs) == 1 {
		return errs[0]
	} else {
		for _, err := range errs {
			debug(m, "multiple failures include: %v", err)
		}
		// Arbitrarily use the error code of the first error
		return libkb.NewProofError(errs[0].GetProofStatus(), "Multiple errors while verifying proof")
	}
}

func setupRegs(m metaContext, regs *namedRegsStore, info ProofInfo, sigBody []byte, sigID keybase1.SigID, service keybase1.ProofType) libkb.ProofError {
	webish := (service == keybase1.ProofType_DNS || service == keybase1.ProofType_GENERIC_WEB_SITE)

	// hint_url
	if err := regs.Set("hint_url", info.APIURL); err != nil {
		return err
	}

	// username_service
	if webish {
		if err := regs.Ban("username_service"); err != nil {
			return err
		}
	} else {
		if err := regs.Set("username_service", info.RemoteUsername); err != nil {
			return err
		}
	}

	// username_keybase
	if err := regs.Set("username_keybase", info.Username); err != nil {
		return err
	}

	// sig
	// Store it b64 encoded. This is rarely used, assert_find_base64 is better.
	if err := regs.Set("sig", b64.StdEncoding.EncodeToString(sigBody)); err != nil {
		return err
	}

	// sig_id_medium
	if err := regs.Set("sig_id_medium", sigID.ToMediumID()); err != nil {
		return err
	}

	// sig_id_short
	if err := regs.Set("sig_id_short", sigID.ToShortID()); err != nil {
		return err
	}

	// hostname
	if webish {
		if err := regs.Set("hostname", info.Hostname); err != nil {
			return err
		}
	} else {
		if err := regs.Ban("hostname"); err != nil {
			return err
		}
	}

	// protocol
	if service == keybase1.ProofType_GENERIC_WEB_SITE {
		canonicalProtocol, ok := validateProtocol(info.Protocol, []string{"http", "https"})
		if !ok {
			return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
				"Bad protocol in sig: %s", info.Protocol)
		}
		if err := regs.Set("protocol", canonicalProtocol); err != nil {
			return err
		}
	} else {
		if err := regs.Ban("protocol"); err != nil {
			return err
		}
	}

	return nil
}

// Get the list of scripts for a given service.
func chunkGetScripts(pvl *pvlT, service keybase1.ProofType) ([]scriptT, libkb.ProofError) {
	scripts, ok := pvl.Services.Map[service]
	if !ok {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"No entry for service: %v", service)
	}
	return scripts, nil
}

// Check that a chunk of PVL is valid code.
// Will always accept valid code, but may not always notice invalidities.
func validateChunk(m metaContext, pvl *pvlT, service keybase1.ProofType) libkb.ProofError {
	if pvl.PvlVersion != SupportedVersion {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"PVL is for the wrong version %v != %v", pvl.PvlVersion, SupportedVersion)
	}

	debug(m, "valid version:%v revision:%v", pvl.PvlVersion, pvl.Revision)

	scripts, perr := chunkGetScripts(pvl, service)
	if perr != nil {
		return perr
	}
	if len(scripts) == 0 {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Empty scripts list for service: %v", service)
	}

	// Scan all the scripts (for this service) for errors. Report the first error.
	var errs []libkb.ProofError
	for whichscript, script := range scripts {
		perr = validateScript(m, &script, service, whichscript)
		errs = append(errs, perr)
	}
	return errs[0]
}

func validateScript(m metaContext, script *scriptT, service keybase1.ProofType, whichscript int) libkb.ProofError {
	// Scan the script.
	// Does not validate each instruction's format. (That is done when running it)
	// Validate each instruction's "error" field.

	logerr := func(m metaContext, service keybase1.ProofType, whichscript int, pc int, format string, arg ...interface{}) libkb.ProofError {
		debugWithPosition(m, service, whichscript, pc, format, arg...)
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, format, arg...)
	}

	var modeknown = false
	var mode fetchMode
	if service == keybase1.ProofType_DNS {
		modeknown = true
		mode = fetchModeDNS
	}
	if len(script.Instructions) < 1 {
		return logerr(m, service, whichscript, 0, "Empty script")
	}

	for i, ins := range script.Instructions {
		if ins.variantsFilled() != 1 {
			return logerr(m, service, whichscript, i, "exactly 1 variant must appear in instruction")
		}

		switch {

		// These can always run, but must be cases so that the default case works.
		case ins.AssertRegexMatch != nil:
		case ins.AssertFindBase64 != nil:
		case ins.AssertCompare != nil:
		case ins.WhitespaceNormalize != nil:
		case ins.RegexCapture != nil:
		case ins.ReplaceAll != nil:
		case ins.ParseURL != nil:
		case ins.Fill != nil:

		case ins.Fetch != nil:
			// A script can contain only <=1 fetches.
			// A DNS script cannot contain fetches.

			fetchType := ins.Fetch.Kind

			if service == keybase1.ProofType_DNS {
				return logerr(m, service, whichscript, i,
					"DNS script cannot contain fetch instruction")
			}
			if modeknown {
				return logerr(m, service, whichscript, i,
					"Script cannot contain multiple fetch instructions")
			}
			switch fetchMode(fetchType) {
			case fetchModeString:
				modeknown = true
				mode = fetchModeString
			case fetchModeHTML:
				modeknown = true
				mode = fetchModeHTML
			case fetchModeJSON:
				modeknown = true
				mode = fetchModeJSON
			default:
				return logerr(m, service, whichscript, i,
					"Unsupported fetch type: %v", fetchType)
			}
		case ins.ParseHTML != nil:
		case ins.SelectorJSON != nil:
			// Can only select after fetching.
			switch {
			case service == keybase1.ProofType_DNS:
				return logerr(m, service, whichscript, i,
					"DNS script cannot use json selector")
			case !modeknown:
				return logerr(m, service, whichscript, i,
					"Script cannot select before fetch")
			case mode != fetchModeJSON:
				return logerr(m, service, whichscript, i,
					"Script contains json selector in non-html mode")
			}
		case ins.SelectorCSS != nil:
			// Can only select one of text, attr, or data.
			if ins.SelectorCSS.Attr != "" && ins.SelectorCSS.Data {
				return logerr(m, service, whichscript, i,
					"Script contains css selector with both 'attr' and 'data' set")
			}
		default:
			return logerr(m, service, whichscript, i,
				"Unsupported PVL instruction: %v", ins)
		}
	}

	return nil
}

// Run each script on each TXT record of each domain.
// Succeed if any succeed.
func runDNS(m metaContext, userdomain string, scripts []scriptT, mknewstate stateMaker, sigIDMedium string) libkb.ProofError {
	domains := []string{userdomain, "_keybase." + userdomain}
	var errs []libkb.ProofError
	for _, d := range domains {
		debug(m, "Trying DNS for domain: %v", d)

		err := runDNSOne(m, d, scripts, mknewstate, sigIDMedium)
		if err != nil {
			errs = append(errs, err)
		} else {
			return nil
		}
	}

	// Return only the error for the first domain error
	if len(errs) == 0 {
		return nil
	}
	var descs []string
	for _, err := range errs {
		descs = append(descs, err.GetDesc())
	}
	// Use the code from the first error
	return libkb.NewProofError(errs[0].GetProofStatus(), strings.Join(descs, "; "))
}

func formatDNSServer(srv string) string {
	if strings.Contains(srv, ":") {
		return fmt.Sprintf("[%s]:53", srv)
	}
	return srv + ":53"
}

func runDNSTXTQuery(m metaContext, domain string) (res []string, err error) {

	// Attempt to use the built-in resolver first, but this might fail on mobile.
	// The reason for that is currently (as of Go 1.8), LookupTXT does not properly
	// use the cgo DNS routines if they are configured to be used (like they are for mobile).
	// As for now, we can use a different library to specify our own name servers, since the
	// Go resolver will attempt to use /etc/resolv.conf, which is not a thing on mobile.
	if res, err = net.LookupTXT(domain); err != nil {
		debug(m, "DNS LookupTXT failed: %s", err.Error())
	} else {
		return res, nil
	}

	// Google IPv4 and IPV6 addresses
	publicServers := []string{
		formatDNSServer("8.8.8.8"),
		formatDNSServer("2001:4860:4860::8888"),
	}
	var fetchedSrvs []string
	if m.G().GetDNSNameServerFetcher() != nil {
		fetchedSrvs = m.G().GetDNSNameServerFetcher().GetServers()
		for i := 0; i < len(fetchedSrvs); i++ {
			fetchedSrvs[i] = formatDNSServer(fetchedSrvs[i])
		}
	}
	servers := append(fetchedSrvs, publicServers...)

	var r *dns.Msg
	c := dns.Client{}
	msg := dns.Msg{}
	found := false
	for _, srv := range servers {
		debug(m, "DNS trying backup server: %s", srv)
		msg.SetQuestion(domain+".", dns.TypeTXT)
		r, _, err = c.Exchange(&msg, srv)
		if err != nil {
			debug(m, "DNS backup server failed; %s", err.Error())
		} else {
			found = true
			break
		}
	}
	if !found {
		return res, fmt.Errorf("failed to lookup DNS: %s", domain)
	}

	for _, ans := range r.Answer {
		if record, ok := ans.(*dns.TXT); ok {
			if len(record.Txt) > 0 {
				res = append(res, record.Txt[len(record.Txt)-1])
			}
		}
	}
	return res, err
}

// Run each script on each TXT record of the domain.
func runDNSOne(m metaContext, domain string, scripts []scriptT, mknewstate stateMaker, sigIDMedium string) libkb.ProofError {
	// Fetch TXT records
	var txts []string
	var err error
	if m.getStubDNS() == nil {
		txts, err = runDNSTXTQuery(m, domain)
	} else {
		txts, err = m.getStubDNS().LookupTXT(domain)
	}

	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_DNS_ERROR,
			"DNS failure for %s: %s", domain, err)
	}

	for _, record := range txts {
		debug(m, "For DNS domain '%s' got TXT record: '%s'", domain, record)

		// Try all scripts.
		for i, script := range scripts {
			state, err := mknewstate(i)
			if err != nil {
				return err
			}

			if err = state.Regs.Set("txt", record); err != nil {
				return err
			}

			if err = runScript(m, &script, state); err == nil {
				return nil
			}

			// Discard error, it has already been reported by stepInstruction.
		}
	}

	return libkb.NewProofError(keybase1.ProofStatus_NOT_FOUND,
		"Checked %d TXT entries of %s, but didn't find signature keybase-site-verification=%s",
		len(txts), domain, sigIDMedium)
}

func runScript(m metaContext, script *scriptT, startstate scriptState) libkb.ProofError {
	var state = startstate
	if len(script.Instructions) < 1 {
		perr := libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Empty scripts are not allowed.")
		debugWithStateError(m, state, perr)
		return perr
	}
	for i, ins := range script.Instructions {
		// Sanity check.
		if state.PC != i {
			perr := libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
				"Execution failure, PC mismatch %v %v", state.PC, i)
			debugWithStateError(m, state, perr)
			return perr
		}

		newstate, perr := stepInstruction(m, ins, state)
		if perr != nil {
			return perr
		}
		state = newstate
		state.PC++
	}

	// Script executed successfully with no errors.
	return nil
}

// stepInstruction decides which instruction to run.
func stepInstruction(m metaContext, ins instructionT, state scriptState) (scriptState, libkb.ProofError) {
	debugWithState(m, state, "Running instruction %v: %v", ins.Name(), ins)

	var newState scriptState
	var stepErr libkb.ProofError
	var customErrSpec *errorT
	switch {
	case ins.AssertRegexMatch != nil:
		newState, stepErr = stepAssertRegexMatch(m, *ins.AssertRegexMatch, state)
		customErrSpec = ins.AssertRegexMatch.Error
	case ins.AssertFindBase64 != nil:
		newState, stepErr = stepAssertFindBase64(m, *ins.AssertFindBase64, state)
		customErrSpec = ins.AssertFindBase64.Error
	case ins.AssertCompare != nil:
		newState, stepErr = stepAssertCompare(m, *ins.AssertCompare, state)
		customErrSpec = ins.AssertCompare.Error
	case ins.WhitespaceNormalize != nil:
		newState, stepErr = stepWhitespaceNormalize(m, *ins.WhitespaceNormalize, state)
		customErrSpec = ins.WhitespaceNormalize.Error
	case ins.RegexCapture != nil:
		newState, stepErr = stepRegexCapture(m, *ins.RegexCapture, state)
		customErrSpec = ins.RegexCapture.Error
	case ins.ReplaceAll != nil:
		newState, stepErr = stepReplaceAll(m, *ins.ReplaceAll, state)
		customErrSpec = ins.ReplaceAll.Error
	case ins.ParseURL != nil:
		newState, stepErr = stepParseURL(m, *ins.ParseURL, state)
		customErrSpec = ins.ParseURL.Error
	case ins.Fetch != nil:
		newState, stepErr = stepFetch(m, *ins.Fetch, state)
		customErrSpec = ins.Fetch.Error
	case ins.ParseHTML != nil:
		newState, stepErr = stepParseHTML(m, *ins.ParseHTML, state)
		customErrSpec = ins.ParseHTML.Error
	case ins.SelectorJSON != nil:
		newState, stepErr = stepSelectorJSON(m, *ins.SelectorJSON, state)
		customErrSpec = ins.SelectorJSON.Error
	case ins.SelectorCSS != nil:
		newState, stepErr = stepSelectorCSS(m, *ins.SelectorCSS, state)
		customErrSpec = ins.SelectorCSS.Error
	case ins.Fill != nil:
		newState, stepErr = stepFill(m, *ins.Fill, state)
		customErrSpec = ins.Fill.Error
	default:
		newState = state
		stepErr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Invalid instruction: %v", ins)
	}

	if stepErr != nil {
		debugWithStateError(m, state, stepErr)
		stepErr = replaceCustomError(m, state, customErrSpec, stepErr)
	}
	return newState, stepErr

}

func stepAssertRegexMatch(m metaContext, ins assertRegexMatchT, state scriptState) (scriptState, libkb.ProofError) {
	rdesc := regexDescriptor{
		Template:        ins.Pattern,
		CaseInsensitive: ins.CaseInsensitive,
		MultiLine:       ins.MultiLine,
	}
	from, err := state.Regs.Get(ins.From)
	if err != nil {
		return state, err
	}
	re, err := interpretRegex(m, state, rdesc)
	if err != nil {
		return state, err
	}
	if re.MatchString(from) == ins.Negate {
		negate := "not "
		if ins.Negate {
			negate = ""
		}
		debugWithState(m, state, "Regex did %smatch:\n  %v\n  %v\n  %q",
			negate, rdesc.Template, re, from)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Regex did %smatch (%v)", negate, rdesc.Template)
	}

	return state, nil
}

func stepAssertFindBase64(m metaContext, ins assertFindBase64T, state scriptState) (scriptState, libkb.ProofError) {
	if ins.Needle != "sig" {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Can only assert_find_base64 for sig")
	}
	haystack, err := state.Regs.Get(ins.Haystack)
	if err != nil {
		return state, err
	}
	if libkb.FindBase64Block(haystack, state.Sig, false) {
		return state, nil
	}
	return state, libkb.NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND,
		"Signature not found")
}

func stepAssertCompare(m metaContext, ins assertCompareT, state scriptState) (scriptState, libkb.ProofError) {
	a, err := state.Regs.Get(ins.A)
	if err != nil {
		return state, err
	}
	b, err := state.Regs.Get(ins.B)
	if err != nil {
		return state, err
	}

	var same bool
	switch ins.Cmp {
	case "exact":
		same = (a == b)
	case "cicmp":
		same = libkb.Cicmp(a, b)
	case "stripdots-then-cicmp":
		norm := func(s string) string {
			return strings.ToLower(strings.Replace(s, ".", "", -1))
		}
		same = libkb.Cicmp(norm(a), norm(b))
	default:
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Unsupported comparison method: '%v'", ins.Cmp)
	}

	if !same {
		debugWithState(m, state, "Comparison (%v) failed\n  %v != %v\n  '%v' != '%v'",
			ins.Cmp, ins.A, ins.B, a, b)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Comparison (%v) failed '%v' != '%v'", ins.Cmp, a, b)
	}

	return state, nil
}

func stepWhitespaceNormalize(m metaContext, ins whitespaceNormalizeT, state scriptState) (scriptState, libkb.ProofError) {
	from, err := state.Regs.Get(ins.From)
	if err != nil {
		return state, err
	}
	normed := libkb.WhitespaceNormalize(from)
	err = state.Regs.Set(ins.Into, normed)
	return state, err
}

func stepRegexCapture(m metaContext, ins regexCaptureT, state scriptState) (scriptState, libkb.ProofError) {
	rdesc := regexDescriptor{
		Template:        ins.Pattern,
		CaseInsensitive: ins.CaseInsensitive,
		MultiLine:       ins.MultiLine,
	}

	from, err := state.Regs.Get(ins.From)
	if err != nil {
		return state, err
	}

	re, err := interpretRegex(m, state, rdesc)
	if err != nil {
		return state, err
	}

	// There must be some registers to write results to.
	if len(ins.Into) == 0 {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Into list cannot be empty")
	}

	match := re.FindStringSubmatch(from)
	// Assert that the match matched and has at least one capture group.
	// -1 for the ignored first element of match
	if len(match)-1 < len(ins.Into) {
		debugWithState(m, state, "Regex capture did not match enough groups:\n  %v\n  %v\n  %q\n  %v",
			rdesc.Template, re, from, match)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Regex capture did not match enough groups (%v)", rdesc.Template)
	}
	for i := 0; i < len(ins.Into); i++ {
		err := state.Regs.Set(ins.Into[i], match[i+1])
		if err != nil {
			return state, err
		}
	}
	return state, nil
}

func stepReplaceAll(m metaContext, ins replaceAllT, state scriptState) (scriptState, libkb.ProofError) {
	from, err := state.Regs.Get(ins.From)
	if err != nil {
		return state, err
	}

	replaced := strings.Replace(from, ins.Old, ins.New, -1)
	if err = state.Regs.Set(ins.Into, replaced); err != nil {
		return state, err
	}

	return state, nil
}

func stepParseURL(m metaContext, ins parseURLT, state scriptState) (scriptState, libkb.ProofError) {
	s, err := state.Regs.Get(ins.From)
	if err != nil {
		return state, err
	}

	u, err2 := url.Parse(s)
	if err2 != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE,
			"Could not parse url: '%v'", s)
	}

	if ins.Path != "" {
		err := state.Regs.Set(ins.Path, u.Path)
		if err != nil {
			return state, err
		}
	}

	if ins.Host != "" {
		err := state.Regs.Set(ins.Host, u.Host)
		if err != nil {
			return state, err
		}
	}

	if ins.Scheme != "" {
		err := state.Regs.Set(ins.Scheme, u.Scheme)
		if err != nil {
			return state, err
		}
	}

	return state, nil
}

func stepFetch(m metaContext, ins fetchT, state scriptState) (scriptState, libkb.ProofError) {
	if state.FetchResult != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Script cannot contain more than one fetch")
	}
	if state.Service == keybase1.ProofType_DNS {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Script cannot fetch in DNS mode")
	}

	from, err := state.Regs.Get(ins.From)
	if err != nil {
		return state, err
	}
	if state.Service == keybase1.ProofType_ROOTER {
		from2, err := rooterRewriteURL(m, from)
		if err != nil {
			return state, libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE,
				"Could not rewrite rooter URL: %v", err)
		}
		from = from2
	}

	switch fetchMode(ins.Kind) {
	case fetchModeString:
		debugWithState(m, state, "fetchurl: %v", from)
		res, err1 := m.G().GetExternalAPI().GetText(libkb.APIArg{Endpoint: from, MetaContext: m.MetaContext})
		if err1 != nil {
			return state, libkb.XapiError(err1, from)
		}
		state.FetchResult = &fetchResult{
			fetchMode: fetchModeString,
			String:    res.Body,
		}
		err := state.Regs.Set(ins.Into, state.FetchResult.String)
		if err != nil {
			return state, err
		}
		return state, nil
	case fetchModeJSON:
		if ins.Into != "" {
			return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
				"JSON fetch must not specify 'into' register")
		}
		res, err1 := m.G().GetExternalAPI().Get(libkb.APIArg{Endpoint: from, MetaContext: m.MetaContext})
		if err1 != nil {
			return state, libkb.XapiError(err1, from)
		}
		state.FetchResult = &fetchResult{
			fetchMode: fetchModeJSON,
			JSON:      res.Body,
		}
		return state, nil
	case fetchModeHTML:
		if ins.Into != "" {
			return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
				"HTML fetch must not specify 'into' register")
		}
		res, err1 := m.G().GetExternalAPI().GetHTML(libkb.APIArg{Endpoint: from, MetaContext: m.MetaContext})
		if err1 != nil {
			return state, libkb.XapiError(err1, from)
		}
		state.FetchResult = &fetchResult{
			fetchMode: fetchModeHTML,
			HTML:      res.GoQuery,
		}
		return state, nil
	default:
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Unsupported fetch kind %v", ins.Kind)
	}
}

func stepParseHTML(m metaContext, ins parseHTMLT, state scriptState) (scriptState, libkb.ProofError) {
	from, err := state.Regs.Get(ins.From)
	if err != nil {
		return state, err
	}

	gq, err2 := goquery.NewDocumentFromReader(bytes.NewBuffer([]byte(from)))
	if err2 != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Failed to parse html from '%v': %v", ins.From, err2)
	}

	state.FetchResult = &fetchResult{
		fetchMode: fetchModeHTML,
		HTML:      gq,
	}
	return state, nil
}

func stepSelectorJSON(m metaContext, ins selectorJSONT, state scriptState) (scriptState, libkb.ProofError) {
	if state.FetchResult == nil || state.FetchResult.fetchMode != fetchModeJSON {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use json selector with non-json fetch result")
	}

	if len(ins.Selectors) < 1 {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Json selector list must contain at least 1 element")
	}

	results, perr := runSelectorJSONInner(m, state, state.FetchResult.JSON, ins.Selectors)
	if perr != nil {
		return state, perr
	}
	if len(results) < 1 {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Json selector did not match any values")
	}
	s := strings.Join(results, " ")

	err := state.Regs.Set(ins.Into, s)
	return state, err
}

func stepSelectorCSS(m metaContext, ins selectorCSST, state scriptState) (scriptState, libkb.ProofError) {
	if state.FetchResult == nil || state.FetchResult.fetchMode != fetchModeHTML {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use css selector with non-html fetch result")
	}

	selection, perr := runCSSSelectorInner(m, state.FetchResult.HTML.Selection, ins.Selectors)
	if perr != nil {
		return state, perr
	}

	if selection.Size() < 1 {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"No elements matched by selector")
	}

	if selection.Size() > 1 && !ins.Multi {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"CSS selector matched too many elements")
	}

	// Get the text, attribute, or data.
	var res string
	if ins.Attr != "" {
		res = selectionAttr(selection, ins.Attr)
	} else if ins.Data {
		res = selectionData(selection)
	} else {
		res = selectionText(selection)
	}

	err := state.Regs.Set(ins.Into, res)
	return state, err
}

func stepFill(m metaContext, ins fillT, state scriptState) (scriptState, libkb.ProofError) {
	s, err := substituteExact(ins.With, state)
	if err != nil {
		debugWithState(m, state, "Fill did not succeed:\n  %v\n  %v\n  %v",
			ins.With, err, ins.Into)
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not fill variable (%v): %v", ins.Into, err)
	}

	err = state.Regs.Set(ins.Into, s)
	return state, err
}

// Run a PVL CSS selector.
// selectors is a list like [ "div .foo", 0, ".bar"] ].
// Each string runs a selector, each integer runs a Eq.
func runCSSSelectorInner(m metaContext, html *goquery.Selection,
	selectors []keybase1.SelectorEntry) (*goquery.Selection, libkb.ProofError) {
	if len(selectors) < 1 {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"CSS selectors array must not be empty")
	}

	var selection *goquery.Selection
	selection = html

	for _, selector := range selectors {
		switch {
		case selector.IsIndex:
			selection = selection.Eq(selector.Index)
		case selector.IsKey:
			selection = selection.Find(selector.Key)
		case selector.IsContents:
			selection = selection.Contents()
		default:
			return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
				"CSS selector entry must be a string, int, or 'contents' %v", selector)
		}
	}

	return selection, nil
}

func runSelectorJSONInner(m metaContext, state scriptState, selectedObject *jsonw.Wrapper,
	selectors []keybase1.SelectorEntry) ([]string, libkb.ProofError) {
	logger := func(format string, args ...interface{}) {
		debugWithState(m, state, format, args)
	}
	jsonResults, perr := jsonhelpers.AtSelectorPath(selectedObject, selectors, logger, libkb.NewInvalidPVLSelectorError)
	if perrInner, _ := perr.(libkb.ProofError); perrInner != nil {
		return nil, perrInner
	}
	if perr != nil {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, "json select error in pvl interp")
	}
	results := []string{}
	for _, object := range jsonResults {
		s, err := jsonhelpers.JSONStringSimple(object)
		if err != nil {
			logger("JSON could not read object: %v (%v)", err, object)
			continue
		}
		results = append(results, s)
	}
	return results, nil
}

// Take a regex descriptor, do variable substitution, and build a regex.
func interpretRegex(m metaContext, state scriptState, rdesc regexDescriptor) (*regexp.Regexp, libkb.ProofError) {
	// Check that regex is bounded by "^" and "$".
	if !strings.HasPrefix(rdesc.Template, "^") {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not build regex: %v (%v)", "must start with '^'", rdesc.Template)
	}
	if !strings.HasSuffix(rdesc.Template, "$") {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not build regex: %v (%v)", "must end with '$'", rdesc.Template)
	}

	var optstring = ""
	if rdesc.CaseInsensitive {
		optstring += "i"
	}
	if rdesc.MultiLine {
		optstring += "m"
	}

	var prefix = ""
	if len(optstring) > 0 {
		prefix = "(?" + optstring + ")"
	}

	// Do variable interpolation.
	prepattern, perr := substituteReEscape(rdesc.Template, state)
	if perr != nil {
		return nil, perr
	}
	pattern := prefix + prepattern

	// Build the regex.
	re, err := regexp.Compile(pattern)
	if err != nil {
		debugWithState(m, state, "Could not compile regex: %v\n  %v\n  %v", err, rdesc.Template, pattern)
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not compile regex: %v (%v)", err, rdesc.Template)
	}
	return re, nil
}

// Use a custom error spec to derive an error.
// spec can be none
// Copies over the error code if none is specified.
func replaceCustomError(m metaContext, state scriptState, spec *errorT, err1 libkb.ProofError) libkb.ProofError {
	if err1 == nil {
		return err1
	}

	// Don't rewrite invalid_pvl errors
	if err1.GetProofStatus() == keybase1.ProofStatus_INVALID_PVL {
		return err1
	}

	if spec == nil {
		return err1
	}

	if (spec.Status != err1.GetProofStatus()) || (spec.Description != err1.GetDesc()) {
		newDesc := spec.Description
		subbedDesc, subErr := substituteExact(spec.Description, state)
		if subErr == nil {
			newDesc = subbedDesc
		}
		err2 := libkb.NewProofError(spec.Status, newDesc)
		debugWithState(m, state, "Replacing error with custom error")
		debugWithStateError(m, state, err2)

		return err2
	}
	return err1
}
