// All of our identity services and matchers are defined here.

// identityMatchers is used to generate our declarative page match rules, but
// also used to check for matches at runtime for each `service` that we
// support. They have the following schema:
// {
//  "service": Service name, if you add one here update `profileInject` in
//  `identities.js` and `User.prototype.href to fully register it.
//
//  "getUsername": Function to parse the username from the browser
//  `location` object.
//
//  "pathMatches": A regular expression used to match the pathname  within the
//  service (i.e. news.ycombinator.com/user?id=username matches but not
//  news.ycombinator.com/newest).
//
//  "originAndPathMatches": A re2 style regex used to match a page within
//  the service for declarativeContent matching
//  (https://developer.chrome.com/extensions/declarativeContent).
//
//  "subdomains": Subdomains that the host is considered valid on.
//
//  "host": Used to match that the host is the host we want to run on
//  (preventing any regex trickery for `pathMatches` or
//  `originAndPathMatches`).
//
//  "css": (optional) CSS selector which must be present for declarativeContent
//  or the chat button to be injected.
//
// }
//
const identityMatchers = [
  {
    service: "keybase",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    pathMatches: new RegExp('^/([\\w]+)[/]?$'),
    originAndPathMatches: '^https://keybase\\.io/[\\w]+[/]?$',
    subdomains: [],
    host: 'keybase.io',
    css: ['.profile-heading']
  },
  {
    service: "reddit",
    getUsername: function(loc) { return loc.pathname.split('/')[2]; },
    pathMatches: new RegExp('^/user/([\\w-]+)[/]?$'),
    originAndPathMatches: '^https://[\\w.-]*?\\.reddit\\.com/user/[\\w-]+[/]?$',
    subdomains: ['np', 'ssl', 'blog', 'fr', 'pay', 'es', 'en-us', 'en', 'ru',
      'us', 'de', 'dd', 'no', 'pt', 'ww', 'ss', '4x', 'sv', 'nl', 'hw', 'hr',
      'www'],
    host: 'reddit.com'
  },
  {
    service: "twitter",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    pathMatches: new RegExp('^/([\\w]+)[/]?$'),
    originAndPathMatches: '^https://twitter\\.com/[\\w]+[/]?$',
    subdomains: [],
    host: 'twitter.com',
    css: ['body.ProfilePage']
  },
  {
    service: "github",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    pathMatches: new RegExp('^/([\\w\-]+)[/]?$'),
    originAndPathMatches: '^https://github\\.com/[\\w\-]+[/]?$',
    subdomains: [],
    host: 'github.com',
    css: ['body.page-profile']
  },
  {
    service: "facebook",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    pathMatches: new RegExp('^/([\\w\\.]+)[/]?$'),
    originAndPathMatches: '^https://(www)?\\.facebook\\.com/[\\w\\.]+[/]?$',
    subdomains: ['www'],
    host: 'facebook.com',
    css: ['body.timelineLayout']
  },
  {
    service: "hackernews",
    getUsername: function(loc) { return document.querySelector('.hnuser').text; },
    pathMatches: new RegExp('^/user'),
    originAndPathMatches: '^https://news\\.ycombinator\\.com/user',
    subdomains: [],
    host: 'news.ycombinator.com',
    css: ['html[op="user"]']
  }
];

function getServiceHosts(service) {
  hosts = [service.host]
  for (const subdomain of service.subdomains) {
    hosts.push(subdomain + '.' + service.host)
  }
  return hosts
}

// Match a window.location and document against a service profile and return
// a User instance. Will skip matching CSS if no document is provided.
function matchService(loc, doc, forceService) {

  for (const m of identityMatchers) {
    if (forceService !== undefined && forceService !== m.service) continue;

    const matched = getServiceHosts(m).some(function(hostName) {
      return hostName === loc.hostname
    }) && loc.pathname.match(m.pathMatches);
    if (!matched) continue;

    const username = safeHTML(m.getUsername(loc));
    if (!username) continue;

    if (doc === undefined || m.css === undefined) return new User(username, m.service);
    for (const css of m.css) {
      if (doc.querySelector(css) !== null) {
        return new User(username, m.service);
      }
    }
  }
}

// User keeps track of the original query and which services we resolved for
// this user. It also handles formatting strings for each service.
function User(username, service) {
  if (service === undefined) service = "keybase";
  this.origin = service;
  this.services = {};
  this.services[service] = username;
  this.extraReplyCls = "";
}

// Return a fresh copy equivalent to how it was initialized.
User.prototype.clone = function() {
  user = new User(this.services[this.origin], this.origin);
  user.extraReplyCls = this.extraReplyCls
  return user
}

User.prototype.query = function() {
  const name = this.services[this.origin];
  if (this.origin === "keybase") {
    return name;
  }
  return `${name}@${this.origin}`;
}

User.prototype.display = function(service) {
  if (service === undefined) service = this.origin;
  const name = this.services[this.origin];
  switch (this.origin) {
    case "reddit":
      return `/u/${name}`;
    case "twitter":
      return `@${name}`;
    default:
      return name;
  }
}

User.prototype.href = function(service) {
  if (service === undefined) service = this.origin;
  const name = this.services[this.origin];
  switch (service) {
    case "keybase":
      return `https://keybase.io/${name}`;
    case "reddit":
      return `https://www.reddit.com/user/${name}`;
    case "twitter":
      return `https://twitter.com/${name}`;
    case "facebook":
      return `https://facebook.com/${name}`;
    case "github":
      return `https://github.com/${name}`;
    case "hackernews":
      return `https://news.ycombinator.com/user?id=${name}`;
    default:
      throw `unknown service: ${this.origin}`;
  }
}

// Convert a user input into a string that is safe for inlining into HTML.
function safeHTML(s) {
  if (!s) return "";
  return s.replace(/[&'"<>\/]/g, function (c) {
    // Per https://www.owasp.org/index.php/XSS_(Cross_Site_Scripting)_Prevention_Cheat_Sheet#RULE_.231_-_HTML_Escape_Before_Inserting_Untrusted_Data_into_HTML_Element_Content
    return {
      '&': "&amp;",
      '"': "&quot;",
      "'": "&#x27",
      '/': "&#x2F",
      '<': "&lt;",
      '>': "&gt;"
    }[c];
  });
}
