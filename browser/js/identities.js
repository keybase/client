// All of our identity services and matchers are defined here.

// parseLocationQuery converts URL-encoded parameters into an object. It
// requires unique keys, will throw an error if there is a duplicate key.
function parseLocationQuery(s) {
  if (s.startsWith("?")) s = s.substr(1);
  if (s == "") return {};
  const params = {};
  const parts = s.split('&');
  for (let i = 0; i < parts.length; i++) {
    let p = parts[i].split('=', 2);
    const key = p[0];
    if (key in params) {
      throw new Error('duplicate key in query string: ' + key);
    }
    if (p.length == 1) {
      params[key] = "";
    } else {
      params[key] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
  }
  return params;
}

// identityMatchers is used to generate our declarative page match rules, but also
// used to check for matches at runtime. Unfortunately, these mechanisms use different
// implementations of regular expressions (re2 vs javascript's regexp) so there's
// some redundancy but at least it's all in one place? :D
const identityMatchers = [
  {
    service: "keybase",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    locationMatches: new RegExp('\\.keybase\\.(?:io|pub)/([\\w]+)[/]?'),
    originAndPathMatches: 'keybase\\.(io|pub)/[\\w]+[/]?',
    hostEquals: ['keybase.io', 'keybase.pub'],
    css: ['.profile-heading']
  },
  {
    service: "keybasepub",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    locationMatches: new RegExp('\\.keybase\\.pub/([\\w]+)[/]?'),
    originAndPathMatches: 'keybase\\.pub/[\\w]+[/]?',
    hostEquals: ['keybase.pub'],
    css: ['.face-card']
  },
  {
    service: "reddit",
    getUsername: function(loc) { return loc.pathname.split('/')[2]; },
    locationMatches: new RegExp('\\.reddit\\.com/user/([\\w-]+)[/]?$'),
    originAndPathMatches: '\\.reddit\\.com/user/[\\w-]+[/]?$',
    hostEquals: ['www.reddit.com', 'reddit.com']
  },
  {
    service: "twitter",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    locationMatches: new RegExp('\\.twitter\\.com/([\\w]+)[/]?$'),
    originAndPathMatches: 'twitter\\.com/[\\w]+[/]?$',
    hostEquals: ['twitter.com'],
    css: ['body.ProfilePage']
  },
  {
    service: "github",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    locationMatches: new RegExp('\\.github\\.com/([\\w\-]+)[/]?$'),
    originAndPathMatches: 'github\\.com/[\\w\-]+[/]?$',
    hostEquals: ['github.com'],
    css: ['body.page-profile']
  },
  {
    service: "facebook",
    getUsername: function(loc) { return loc.pathname.split('/')[1]; },
    locationMatches: new RegExp('\\.facebook\\.com/([\\w\\.]+)[/]?$'),
    originAndPathMatches: '\\.facebook\\.com/[\\w\\.]+[/]?$',
    hostEquals: ['facebook.com', 'www.facebook.com'],
    css: ['body.timelineLayout']
  },
  {
    service: "hackernews",
    getUsername: function(loc) { return parseLocationQuery(loc.search)["id"]; },
    locationMatches: new RegExp('news\\.ycombinator\\.com/user'),
    originAndPathMatches: 'news\\.ycombinator\\.com/user',
    hostEquals: ['news.ycombinator.com'],
    css: ['html[op="user"]']
  }
];

// Match a window.location and document against a service profile and return
// a User instance. Will skip matching CSS if no document is provided.
function matchService(loc, doc, forceService) {
  // Prefix the url with a period if there is no subdomain.
  const hasSubdomain = loc.hostname.indexOf(".") !== loc.hostname.lastIndexOf(".");
  const url = (!hasSubdomain && ".") + loc.hostname + loc.pathname;

  for (const m of identityMatchers) {
    if (forceService !== undefined && forceService !== m.service) continue;

    const matched = m.hostEquals.some(function(hostName) {
      return hostName === loc.hostname
    }) && url.match(m.locationMatches);
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
}

// Return a fresh copy equivalent to how it was initialized.
User.prototype.clone = function() {
  return new User(this.services[this.origin], this.origin);
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
    case "keybasepub":
      return `https://keybase.pub/${name}`;
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
