// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/keybase/client/go/contacts"
	email_utils "github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"golang.org/x/text/unicode/norm"
)

type UserSearchProvider interface {
	MakeSearchRequest(libkb.MetaContext, keybase1.UserSearchArg) ([]keybase1.APIUserSearchResult, error)
}

type UserSearchHandler struct {
	libkb.Contextified
	*BaseHandler

	contactsProvider *contacts.CachedContactsProvider
	// Tests can overwrite searchProvider with mock types.
	searchProvider UserSearchProvider
}

func NewUserSearchHandler(xp rpc.Transporter, g *libkb.GlobalContext, provider *contacts.CachedContactsProvider) *UserSearchHandler {
	handler := &UserSearchHandler{
		Contextified:     libkb.NewContextified(g),
		BaseHandler:      NewBaseHandler(g, xp),
		contactsProvider: provider,
		searchProvider:   &KeybaseAPISearchProvider{},
	}
	return handler
}

var _ keybase1.UserSearchInterface = (*UserSearchHandler)(nil)

type rawSearchResults struct {
	libkb.AppStatusEmbed
	List []keybase1.APIUserSearchResult `json:"list"`
}

type KeybaseAPISearchProvider struct{}

func (*KeybaseAPISearchProvider) MakeSearchRequest(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	service := arg.Service
	if service == "keybase" {
		service = ""
	}
	apiArg := libkb.APIArg{
		Endpoint:    "user/user_search",
		SessionType: libkb.APISessionTypeOPTIONAL,
		Args: libkb.HTTPArgs{
			"q":                        libkb.S{Val: arg.Query},
			"num_wanted":               libkb.I{Val: arg.MaxResults},
			"service":                  libkb.S{Val: service},
			"include_services_summary": libkb.B{Val: arg.IncludeServicesSummary},
		},
	}
	var response rawSearchResults
	err = mctx.G().API.GetDecode(mctx, apiArg, &response)
	if err != nil {
		return nil, err
	}
	return response.List, nil
}

func normalizeText(str string) string {
	return strings.ToLower(string(norm.NFKD.Bytes([]byte(str))))
}

var splitRxx = regexp.MustCompile(`[-\s!$%^&*()_+|~=` + "`" + `{}\[\]:";'<>?,.\/]+`)

func queryToRegexp(q string) (*regexp.Regexp, error) {
	parts := splitRxx.Split(q, -1)
	nonEmptyParts := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			nonEmptyParts = append(nonEmptyParts, p)
		}
	}
	rxx, err := regexp.Compile(strings.Join(nonEmptyParts, ".*"))
	if err != nil {
		return nil, err
	}
	rxx.Longest()
	return rxx, nil
}

type compiledQuery struct {
	query string
	rxx   *regexp.Regexp
}

func compileQuery(query string) (res compiledQuery, err error) {
	query = normalizeText(query)
	rxx, err := queryToRegexp(query)
	if err != nil {
		return res, err
	}
	res = compiledQuery{
		query: query,
		rxx:   rxx,
	}
	return res, nil
}

func (q *compiledQuery) scoreString(str string) (bool, float64) {
	norm := normalizeText(str)
	if norm == q.query {
		return true, 1
	}

	index := q.rxx.FindStringIndex(norm)
	if index == nil {
		return false, 0
	}

	leadingScore := 1.0 / float64(1+index[0])
	lengthScore := 1.0 / float64(1+len(norm))
	imperfection := 0.5
	score := leadingScore * lengthScore * imperfection
	return true, score
}

var fieldsAndScores = []struct {
	multiplier float64
	plumb      bool // plumb the matched value to displayLabel
	getter     func(*keybase1.ProcessedContact) string
}{
	{1.5, true, func(contact *keybase1.ProcessedContact) string { return contact.ContactName }},
	{1.0, true, func(contact *keybase1.ProcessedContact) string { return contact.Component.ValueString() }},
	{1.0, false, func(contact *keybase1.ProcessedContact) string { return contact.DisplayName }},
	{0.8, false, func(contact *keybase1.ProcessedContact) string { return contact.DisplayLabel }},
	{0.7, false, func(contact *keybase1.ProcessedContact) string { return contact.FullName }},
	{0.7, false, func(contact *keybase1.ProcessedContact) string { return contact.Username }},
}

func matchAndScoreContact(query compiledQuery, contact keybase1.ProcessedContact) (found bool, score float64, plumbMatchedVal string) {
	var currentScore float64
	var multiplier float64
	for _, v := range fieldsAndScores {
		str := v.getter(&contact)
		if str == "" {
			continue
		}
		matchFound, matchScore := query.scoreString(str)
		if matchFound && matchScore > currentScore {
			plumbMatchedVal = ""
			if v.plumb {
				plumbMatchedVal = str
			}
			found = true
			currentScore = matchScore
			multiplier = v.multiplier
		}

	}
	return found, currentScore * multiplier, plumbMatchedVal
}

func compareUserSearch(i, j keybase1.APIUserSearchResult) bool {
	// Float comparasion - we expect exact floats here when multiple
	// results match in same way and yield identical score thorugh
	// same scoring operations.
	if i.RawScore == j.RawScore {
		idI := i.GetStringIDForCompare()
		idJ := j.GetStringIDForCompare()
		return idI > idJ
	}
	return i.RawScore > j.RawScore
}

func contactSearch(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	contactsRes, err := mctx.G().SyncedContactList.RetrieveContacts(mctx)
	if err != nil {
		return res, err
	}

	query, err := compileQuery(arg.Query)
	if err != nil {
		return res, nil
	}

	// Deduplicate on name and label - never return multiple identical rows
	// even if separate components yielded them.
	type displayNameAndLabel struct {
		name, label string
	}
	searchResults := make(map[displayNameAndLabel]keybase1.APIUserSearchResult)

	// Set of contact indices that we've matched to and are resolved. When
	// search matches to a contact component, we want to only present the
	// resolved one and skip unresolved.
	seenResolvedContacts := make(map[int]struct{})

	for _, contactIter := range contactsRes {
		found, score, matchedVal := matchAndScoreContact(query, contactIter)
		if found {
			// Copy contact because we are storing pointer to contact.
			contact := contactIter
			if contact.Resolved {
				if matchedVal != "" {
					// If contact is resolved, make sure to plumb matched query to
					// display label. This is not needed for unresolved contacts,
					// which can only match on ContactName or Component Value, and
					// both of them always appear as name and label.
					contact.DisplayLabel = matchedVal
				}

				// If we got a resolved match, add bonus to the score so it
				// stands out from similar matches.
				score *= 1.5

				// Mark contact index so we skip it when populating return list.
				seenResolvedContacts[contact.ContactIndex] = struct{}{}
			} else {
				if _, seen := seenResolvedContacts[contact.ContactIndex]; seen {
					// Other component of this contact has resolved to a user, skip
					// all non-resolved components.
					continue
				}
				if contact.Component.PhoneNumber != nil {
					// Phone numbers are better, "mobile" phone numbers are best.
					// This is for sorting matches within one contact (for which we expect
					// the scores to be equal), so only increase by a small amount.
					score *= 1.01
					if contact.Component.Label == "mobile" {
						score *= 1.01
					}
				}
			}

			key := displayNameAndLabel{contact.DisplayName, contact.DisplayLabel}
			replace := true
			if current, found := searchResults[key]; found {
				replace = (contact.Resolved && !current.Contact.Resolved) || (score > current.RawScore)
			}

			if replace {
				searchResults[key] = keybase1.APIUserSearchResult{
					Contact:  &contact,
					RawScore: score,
				}
			}
		}
	}

	for _, entry := range searchResults {
		if !entry.Contact.Resolved {
			if _, seen := seenResolvedContacts[entry.Contact.ContactIndex]; seen {
				// Other component of this contact has resolved to a user, skip
				// all non-resolved components.
				continue
			}
		}

		res = append(res, entry)
	}

	// Return best matches first.
	sort.Slice(res, func(i, j int) bool {
		return compareUserSearch(res[i], res[j])
	})

	// Trim to maxResults to reduce complexity on the call site.
	maxRes := arg.MaxResults
	if maxRes > 0 && len(res) > maxRes {
		res = res[:maxRes]
	}

	return res, nil
}

func imptofuQueryToAssertion(ctx context.Context, typ, val string) (ret libkb.AssertionURL, err error) {
	parsef := func(key, val string) (libkb.AssertionURL, error) {
		return libkb.ParseAssertionURLKeyValue(
			externals.MakeStaticAssertionContext(ctx), key, val, true)
	}
	switch typ {
	case "phone":
		ret, err = parsef("phone", keybase1.PhoneNumberToAssertionValue(val))
	case "email":
		ret, err = parsef("email", strings.ToLower(strings.TrimSpace(val)))
	default:
		err = fmt.Errorf("invalid assertion type for imptofuQueryToAssertion, got %q", typ)
	}
	return ret, err
}

// Search result coming from `searchEmailsOrPhoneNumbers`.
type imptofuQueryResult struct {
	input      string
	validInput bool
	assertion  libkb.AssertionURL

	found      bool
	UID        keybase1.UID
	username   string
	fullName   string
	serviceMap libkb.UserServiceSummary
}

type searchEmailsOrPhoneNumbersResult struct {
	emails       []imptofuQueryResult
	phoneNumbers []imptofuQueryResult
}

func (h *UserSearchHandler) searchEmailsOrPhoneNumbers(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	phoneNumbers []keybase1.RawPhoneNumber, requireUsernames bool,
	includeServicesSummary bool) (ret searchEmailsOrPhoneNumbersResult, err error) {

	// Create assertions from e-mail addresses. Only search for the ones that
	// actually yield a valid assertions, but return all of them in results
	// from this function.
	emailsToSearch := make([]keybase1.EmailAddress, 0, len(emails))
	emailRes := make([]imptofuQueryResult, len(emails))
	for i, email := range emails {
		emailRes[i].input = string(email)
		assertion, err := imptofuQueryToAssertion(mctx.Ctx(), "email", string(email))
		if err == nil {
			emailRes[i].validInput = true
			emailRes[i].assertion = assertion
			emailsToSearch = append(emailsToSearch, email)
		} else {
			mctx.Debug("Failed to create assertion from email: %s, skipping in search", email)
		}
	}

	phonesToSearch := make([]keybase1.RawPhoneNumber, 0, len(phoneNumbers))
	phoneRes := make([]imptofuQueryResult, len(phoneNumbers))
	for i, phone := range phoneNumbers {
		phoneRes[i].input = string(phone)
		assertion, err := imptofuQueryToAssertion(mctx.Ctx(), "phone", string(phone))
		if err == nil {
			phoneRes[i].validInput = true
			phoneRes[i].assertion = assertion
			phonesToSearch = append(phonesToSearch, phone)
		} else {
			mctx.Debug("Failed to create assertion from phone number: %s, skipping in search", phone)
		}
	}

	ret.emails = emailRes
	ret.phoneNumbers = phoneRes

	if len(emailsToSearch)+len(phonesToSearch) == 0 {
		// Everything was invalid (or we were given two empty lists).
		return ret, nil
	}

	lookupRes, err := h.contactsProvider.LookupAll(mctx, emailsToSearch, phonesToSearch)
	if err != nil {
		return ret, err
	}
	if len(lookupRes.Results) == 0 {
		return ret, nil
	}

	uids := make([]keybase1.UID, 0, len(lookupRes.Results))
	for _, v := range lookupRes.Results {
		if v.Error == "" && v.UID.Exists() {
			uids = append(uids, v.UID)
		}
	}

	usernames, err := h.contactsProvider.FindUsernames(mctx, uids)
	if err != nil {
		if requireUsernames {
			return ret, err
		}
		mctx.Warning("Cannot find usernames for search results: %s", err)
	}

	var serviceMaps map[keybase1.UID]libkb.UserServiceSummary
	if includeServicesSummary {
		serviceMaps, err = h.contactsProvider.FindServiceMaps(mctx, uids)
		if err != nil {
			mctx.Warning("Cannot get service maps for search results: %s", err)
		}
	}

	copyResult := func(slice []imptofuQueryResult, index int, result contacts.ContactLookupResult) {
		if result.Error != "" || result.UID.IsNil() {
			return
		}

		row := slice[index]
		row.found = true
		row.UID = result.UID
		usernamePkg, ok := usernames[result.UID]
		if ok {
			row.username = usernamePkg.Username
			row.fullName = usernamePkg.Fullname
		}
		row.serviceMap = serviceMaps[result.UID]

		assertion := row.assertion
		if result.Coerced != "" && result.Coerced != assertion.GetValue() {
			// Server corrected our assertion - take it instead of what we have.
			assertion, err := imptofuQueryToAssertion(mctx.Ctx(), assertion.GetKey(), result.Coerced)
			if err == nil {
				row.assertion = assertion
			} else {
				mctx.Warning("Failed to create assertion from coerced result: %s", err)
			}
		}

		slice[index] = row
	}

	for i, email := range emails {
		lookupKey := contacts.MakeEmailLookupKey(email)
		result, found := lookupRes.Results[lookupKey]
		if found {
			copyResult(emailRes, i, result)
		}
	}

	for i, phone := range phoneNumbers {
		lookupKey := contacts.MakePhoneLookupKey(phone)
		result, found := lookupRes.Results[lookupKey]
		if found {
			copyResult(phoneRes, i, result)
		}
	}

	return ret, nil
}

func (h *UserSearchHandler) imptofuSearch(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	var emails []keybase1.EmailAddress
	var phones []keybase1.RawPhoneNumber

	switch arg.Service {
	case "email":
		emails = append(emails, keybase1.EmailAddress(arg.Query))
	case "phone":
		phones = append(phones, keybase1.RawPhoneNumber(arg.Query))
	default:
		return nil, fmt.Errorf("unexpected service=%q in imptofuSearch", arg.Service)
	}

	searchRet, err := h.searchEmailsOrPhoneNumbers(mctx, emails, phones, false /* requireUsernames */, arg.IncludeServicesSummary)
	if err != nil {
		return nil, err
	}

	slice := searchRet.emails
	slice = append(slice, searchRet.phoneNumbers...)
	if len(slice) != 1 {
		return nil, fmt.Errorf("Expected 1 result from `searchEmailsOrPhoneNumbers` but got %d", len(slice))
	}

	result := slice[0]
	if !result.validInput {
		return nil, fmt.Errorf("Invalid input: %q", result.input)
	}

	imptofu := &keybase1.ImpTofuSearchResult{
		Assertion:      result.assertion.String(),
		AssertionKey:   result.assertion.GetKey(),
		AssertionValue: result.assertion.GetValue(),
	}
	var servicesSummary map[keybase1.APIUserServiceID]keybase1.APIUserServiceSummary
	if result.found {
		imptofu.KeybaseUsername = result.username
		imptofu.PrettyName = result.fullName
		if result.serviceMap != nil {
			servicesSummary = make(map[keybase1.APIUserServiceID]keybase1.APIUserServiceSummary, len(result.serviceMap))
			for serviceID, username := range result.serviceMap {
				serviceName := keybase1.APIUserServiceID(serviceID)
				servicesSummary[serviceName] = keybase1.APIUserServiceSummary{
					ServiceName: serviceName,
					Username:    username,
				}
			}
		}
	}

	res = []keybase1.APIUserSearchResult{{
		Score:           1.0,
		Imptofu:         imptofu,
		ServicesSummary: servicesSummary,
	}}

	return res, nil
}

func (h *UserSearchHandler) makeSearchRequest(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	res, err = h.searchProvider.MakeSearchRequest(mctx, arg)
	if err != nil {
		return nil, err
	}

	// Downcase usernames, pluck raw score into outer struct.
	for i, row := range res {
		if row.Keybase != nil {
			res[i].Keybase.Username = strings.ToLower(row.Keybase.Username)
			res[i].RawScore = row.Keybase.RawScore
		}
		if row.Service != nil {
			res[i].Service.Username = strings.ToLower(row.Service.Username)
		}
	}

	return res, nil
}

func (h *UserSearchHandler) keybaseSearchWithContacts(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	res, err = h.makeSearchRequest(mctx, arg)
	if err != nil {
		mctx.Warning("Failed to do an API search for %q: %s", arg.Service, err)
	}

	if arg.IncludeContacts {
		contactsRes, err := contactSearch(mctx, arg)
		if err != nil {
			mctx.Warning("Failed to do contacts search: %s", err)
			return res, nil
		}

		// Filter contacts - If we have a username match coming from the
		// service, prefer it instead of contact result for the same user
		// but with SBS assertion in it.
		usernameSet := make(map[string]struct{}, len(res)) // set of usernames
		for _, result := range res {
			if result.Keybase != nil {
				// All current results should be Keybase but be safe in
				// case code in this function changes.
				usernameSet[result.Keybase.Username] = struct{}{}
			}
		}

		for _, contact := range contactsRes {
			if contact.Contact.Resolved {
				// Do not add this contact result if there already is a
				// keybase result with username that the contact resolved
				// to.
				username := contact.Contact.Username
				if _, found := usernameSet[username]; found {
					continue
				}
				usernameSet[username] = struct{}{}
			}
			res = append(res, contact)
		}

		sort.Slice(res, func(i, j int) bool {
			return compareUserSearch(res[i], res[j])
		})

		for i := range res {
			res[i].Score = 1.0 / float64(1+i)
		}

		// Trim the whole result to MaxResult.
		maxRes := arg.MaxResults
		if maxRes > 0 && len(res) > maxRes {
			res = res[:maxRes]
		}
	}

	return res, nil
}

func (h *UserSearchHandler) UserSearch(ctx context.Context, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("USEARCH")
	defer mctx.Trace(fmt.Sprintf("UserSearch#UserSearch(s=%q, q=%q)", arg.Service, arg.Query),
		&err)()

	if arg.Service == "" {
		return nil, fmt.Errorf("unexpected empty `Service` argument")
	} else if arg.IncludeContacts && arg.Service != "keybase" {
		return nil, fmt.Errorf("`IncludeContacts` is only valid with service=\"keybase\" (got service=%q)", arg.Service)
	}

	if arg.Query == "" {
		return nil, nil
	}

	switch arg.Service {
	case "keybase":
		return h.keybaseSearchWithContacts(mctx, arg)
	case "phone", "email":
		return h.imptofuSearch(mctx, arg)
	default:
		return h.makeSearchRequest(mctx, arg)
	}
}

func (h *UserSearchHandler) GetNonUserDetails(ctx context.Context, arg keybase1.GetNonUserDetailsArg) (res keybase1.NonUserDetails, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("UserSearch#GetNonUserDetails(%q)", arg.Assertion),
		&err)()

	actx := mctx.G().MakeAssertionContext(mctx)
	url, err := libkb.ParseAssertionURL(actx, arg.Assertion, true /* strict */)
	if err != nil {
		return res, err
	}

	username := url.GetValue()
	service := url.GetKey()
	res.AssertionValue = username
	res.AssertionKey = service

	if url.IsKeybase() {
		res.IsNonUser = false
		res.Description = "Keybase user"
		return res, nil
	}

	res.IsNonUser = true
	assertion := url.String()

	if url.IsSocial() {
		caser := cases.Title(language.AmericanEnglish)
		res.Description = fmt.Sprintf("%s user", caser.String(service))
		apiRes, err := h.makeSearchRequest(mctx, keybase1.UserSearchArg{
			Query:                  username,
			Service:                service,
			IncludeServicesSummary: false,
			MaxResults:             1,
		})
		if err == nil {
			for _, v := range apiRes {
				s := v.Service
				if s != nil && strings.EqualFold(s.Username, username) && string(s.ServiceName) == service {
					res.Service = s
				}
			}
		} else {
			mctx.Warning("Can't get external profile data with: %s", err)
		}

		res.SiteIcon = libkb.MakeProofIcons(mctx, service, libkb.ProofIconTypeSmall, 16)
		res.SiteIconDarkmode = libkb.MakeProofIcons(mctx, service, libkb.ProofIconTypeSmallDarkmode, 16)
		res.SiteIconFull = libkb.MakeProofIcons(mctx, service, libkb.ProofIconTypeFull, 64)
		res.SiteIconFullDarkmode = libkb.MakeProofIcons(mctx, service, libkb.ProofIconTypeFullDarkmode, 64)
	} else if service == "phone" || service == "email" {
		contacts, err := mctx.G().SyncedContactList.RetrieveContacts(mctx)
		if err == nil {
			for _, v := range contacts {
				if v.Assertion == assertion {
					contact := v
					res.Contact = &contact
					break
				}
			}
		} else {
			mctx.Warning("Can't get contact list to match assertion: %s", err)
		}

		switch service {
		case "phone":
			res.Description = "Phone contact"
		case "email":
			res.Description = "E-mail contact"
		}
	}

	return res, nil
}

func (h *UserSearchHandler) BulkEmailOrPhoneSearch(ctx context.Context,
	arg keybase1.BulkEmailOrPhoneSearchArg) (ret []keybase1.EmailOrPhoneNumberSearchResult, err error) {

	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("UserSearch#BulkEmailOrPhoneSearch(%d emails,%d phones)",
		len(arg.Emails), len(arg.PhoneNumbers)), &err)()

	// Use `emails` package to split comma/newline separated list of emails
	// into actual list of valid emails.
	emailStrings := email_utils.ParseSeparatedEmails(mctx, arg.Emails, nil /* malformed */)
	emails := make([]keybase1.EmailAddress, len(emailStrings))
	for i, v := range emailStrings {
		emails[i] = keybase1.EmailAddress(v)
	}

	// We ask callers to give us valid phone numbers as the argument even
	// though `searchEmailsOrPhoneNumbers` could handle invalid or
	// mis-formatted numbers as well (in theory).

	// TODO: It's probably a good idea to figure out which one it is and clean
	// this code up.

	phones := make([]keybase1.RawPhoneNumber, len(arg.PhoneNumbers))
	for i, v := range arg.PhoneNumbers {
		phones[i] = keybase1.RawPhoneNumber(v)
	}

	searchRet, err := h.searchEmailsOrPhoneNumbers(mctx, emails, phones,
		false /* requireUsernames */, false /* includeServiceSummary */)
	if err != nil {
		return ret, err
	}

	// Caller shouldn't care about the ordering here, we are mixing everything
	// together and returning as one list.
	all := searchRet.emails
	all = append(all, searchRet.phoneNumbers...)
	ret = make([]keybase1.EmailOrPhoneNumberSearchResult, 0, len(all))
	for _, result := range all {
		if !result.validInput {
			continue
		}

		// Localize result to keybase1 type.
		locRes := keybase1.EmailOrPhoneNumberSearchResult{
			Input:          result.input,
			Assertion:      result.assertion.String(),
			AssertionKey:   result.assertion.GetKey(),
			AssertionValue: result.assertion.GetValue(),
		}
		if result.found && result.username != "" {
			locRes.FoundUser = result.found
			locRes.Username = result.username
			locRes.FullName = result.fullName
		}

		ret = append(ret, locRes)
	}

	return ret, nil
}
