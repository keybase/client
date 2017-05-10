// All of our identity services and matchers are defined here.

// identityMatchers is used to generate our declarative page match rules, but also
// used to check for matches at runtime. Unfortunately, these mechanisms use different
// implementations of regular expressions (re2 vs javascript's regexp) so there's
// some redundancy but at least it's all in one place? :D
const identityMatchers = [
  {
    service: "keybase",
    locationMatches: new RegExp('\.keybase\.(io|pub)/[\\w]+[/]?'),
    originAndPathMatches: '\.keybase\.(io|pub)/[\\w]+[/]?',
    css: ['a[rel="me"]']
  },
  {
    service: "reddit",
    locationMatches: new RegExp('\.reddit.com/user/[\\w-]+$'),
    originAndPathMatches: '\.reddit.com/user/[\\w-]+$',
  },
  {
    service: "twitter",
    locationMatches: new RegExp('\.twitter\.com/[\\w]+[/]?$'),
    originAndPathMatches: '\.twitter\.com/[\\w]+[/]?$',
    css: ['body.ProfilePage']
  },
  {
    service: "github",
    locationMatches: new RegExp('\.github\.com/[\\w]+[/]?$'),
    originAndPathMatches: '\.github\.com/[\\w]+[/]?$',
    css: ['body.page-profile']
  },
  {
    service: "hackernews",
    locationMatches: new RegExp('news\.ycombinator\.com/user'),
    originAndPathMatches: 'news\.ycombinator\.com/user',
    css: ['html[op="user"]']
  }
];

// User keeps track of the original query and which services we resolved for
// this user. It also handles formatting strings for each service.
function User(username, service) {
  if (service === undefined) service = "keybase";
  this.origin = service;
  this.services = {};
  this.services[service] = username;
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
  switch (this.origin) {
    case "keybase":
      return `https://keybase.io/${name}`;
    case "reddit":
      return `https://www.reddit.com/user/${name}`;
    case "twitter":
      return `https://twitter.com/${name}`;
    case "github":
      return `https://github.com/${name}`;
    case "hackernews":
      return `https://news.ycombinator.com/user?id=${name}`;
    default:
      throw `unknown service: ${this.origin}`;
  }
}

