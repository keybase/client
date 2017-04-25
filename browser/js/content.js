"use strict";

function init() {
  // Only do work on reddit.
  if (!location.hostname.endsWith('.reddit.com')) return;

  // FIXME: This can be more declarative in the future.
  if (checkCompose.test(location.pathname)) injectCompose();
  else if (checkProfile.test(location.pathname)) injectProfile();
  else if (checkThread.test(location.pathname)) injectThread();
}
window.addEventListener('load', init);


const checkCompose = /^\/message\/compose$/
function injectCompose() {
  // /message/compose
  // TODO: ...
}

const checkProfile = /^\/user\//;
function injectProfile() {
  // /user/<user>
  // TODO: ...
}

const checkThread = /^\/r\/\w+\/comments\/\w+\//;
function injectThread() {
  // /r/<subreddit>/comments/<id>/<slug>
  for (let c of document.getElementsByClassName("comment")) {
    const author = safeHTML(c.getAttribute("data-author"));
    if (author == "") continue; // Empty
    const buttons = c.getElementsByClassName("buttons")[0];

    renderChatButton(buttons, author);
  }
}

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
    case "reddit":
      return `https://www.reddit.com/user/${name}`;
    case "twitter":
      return `https://twitter.com/${name}`;
    default:
      throw `unknown service: ${this.origin}`;
  }
}

// Global state of which chat window is currently open.
let openChat = null;

// Render the "keybase chat reply" button with handlers.
function renderRedditChatButton(parent, toUsername) {
  const isLoggedIn = document.getElementsByClassName("logout").length > 0;
  const user = new User(toUsername, "reddit");
  const li = document.createElement("li");
  li.className = "keybase-reply";
  li.innerHTML = `<a href="keybase://${user.query()}/">keybase chat reply</a>`;


  li.getElementsByTagName("a")[0].addEventListener('click', function(e) {
    e.preventDefault();
    const chatParent = e.currentTarget.parentNode;

    if (chatParent.getElementsByTagName("form").length > 0) {
      // Current chat widget is already open, toggle it and exit
      if (removeChat(openChat)) {
        openChat = null;
      }
      return
    } else if (openChat) {
      // A different chat widget is open, close it and open the new one
      if (!removeChat(openChat)) {
        // Aborted
        return
      }
    }

    openChat = renderChat(chatParent, user, isLoggedIn /* nudgeSupported */);
  });

  parent.appendChild(li);
}

// Render the "Encrypt to..." contact header for the chat widget.
function renderChatContact(el, user) {
  const asset = chrome.runtime.getURL;
  const keybaseUsername = user.services["keybase"];
  let queryStatus, iconSrc;
  if (keybaseUsername) {
    queryStatus = `<a class="keybase-user" href="https://keybase.io/${keybaseUsername}" target="_blank"><span>${keybaseUsername}</span></a> on Keybase`;
    iconSrc = `<img class="keybase-icon" src="https://keybase.io/${keybaseUsername}/picture" />`;
  } else {
    queryStatus = "Searching...";
    if (keybaseUsername == null) {
      queryStatus = "(Not yet on Keybase)";
    }
    iconSrc = `
      <img class="keybase-icon"
           src="${asset("images/icon-placeholder-avatar-32.png")}"
           srcset="${asset("images/icon-placeholder-avatar-32@2x.png")} 2x, ${asset("images/icon-placeholder-avatar-32@3x.png")} 3x"
           />
    `;
  }
  el.innerHTML = `
    <div>${iconSrc}</div>
    Encrypt to <a class="keybase-user ${user.origin}" href="${user.href()}" target="_blank">${user.display()}</a>
    <small>${queryStatus}</small>
  `;
}

// Render the Keybase chat reply widget
function renderChat(parent, user, nudgeSupported, closeCallback) {
  let nudgeHTML;
  if (nudgeSupported) {
    nudgeHTML = `
      <p>
        <label><input type="checkbox" name="keybase-nudgecheck" checked /> <strong>Nudge publicly</strong> (reply in thread so they know about Keybase)</label>
        <textarea name="keybase-nudgetext">${user.display()} - I left you an end-to-end encrypted reply in Keybase. https://keybase.io/reddit-crypto</textarea>
      </p>
    `;
  } else {
    nudgeHTML = `
      <p>You will need to let <a target="_blank" href="${user.href()}" class="external-user">${user.display()}</a> know that they have a Keybase message waiting for them.</p>
      <p>Share this handy link: <a target="_blank" href="https://keybase.io/reddit-crypto">https://keybase.io/reddit-crypto</a></p>
    `;
  }

  // The chat widget is enclosed in the form element.
  const asset = chrome.runtime.getURL;
  const f = document.createElement("form");
  f.action = "#"; // Avoid submitting even if we fail to preventDefault
  f.innerHTML = `
    <h3>
      <img src="${asset("images/icon-keybase-logo-16.png")}"
           srcset="${asset("images/icon-keybase-logo-16@2x.png")} 2x, ${asset("images/icon-keybase-logo-16@3x.png")} 3x"
           />
      Keybase chat <span class="keybase-close">
      </span>
    </h3>
    <div class="keybase-body">
      <div class="keybase-contact"></div>
      <input type="hidden" name="keybase-to" value="${user.query()}" />
      <label>
        <textarea name="keybase-chat" rows="6" placeholder="Write a message"></textarea>
      </label>
      <div class="keybase-nudge"></div>
      <p style="text-align: center;"><input type="submit" value="Send" name="keybase-submit" /></p>
    </div>
  `;
  f.addEventListener("submit", submitChat.bind(null, closeCallback));
  parent.insertBefore(f, parent.firstChild);

  const contactDiv = f.getElementsByClassName("keybase-contact")[0];
  renderChatContact(contactDiv, user);

  // Find user
  const nudgePlaceholder = f.getElementsByClassName("keybase-nudge")[0];
  chrome.runtime.sendMessage({
    "method": "query",
    "to": user.query(),
  }, function(response) {
    if (response.status == "ok") {
      user.services["keybase"] = safeHTML(response.result["username"]);
      renderChatContact(contactDiv, user);
      return;
    } else if (response.message != "user not found") {
      renderError(f, response.message);
    }
    user.services["keybase"] = null;
    renderChatContact(contactDiv, user);
    nudgePlaceholder.innerHTML = nudgeHTML;

    // Install nudge toggle
    const nudgeCheck = f["keybase-nudgecheck"];
    if (nudgeCheck !== undefined) {
      nudgeCheck.addEventListener("change", function(e) {
        f["keybase-nudgetext"].hidden = !e.currentTarget.checked;
      });
    }
  });

  // Install closing button (the "x" in the corner)
  const closer = f.getElementsByClassName("keybase-close")[0];
  closer.addEventListener("click", function(e) {
    if (removeChat(f)) {
      closeCallback !== undefined && closeCallback();
    }
  });

  // Install submit button disabler/enabler
  const chatBody = f["keybase-chat"];
  const submitButton = f["keybase-submit"];
  submitButton.disabled = true;
  function chatChangeCallback(event) {
    submitButton.disabled = event.target.value == "";
  };
  chatBody.addEventListener("change", chatChangeCallback);
  chatBody.addEventListener("keyup", chatChangeCallback);

  // Focus the chat textarea
  f["keybase-chat"].focus();

  // TODO: Also add an onbeforeunload check if chat has text written in it.
  return f;
}

// Remove the chat widget from the DOM
function removeChat(chatForm, skipCheck) {
  if (!chatForm.parentNode) {
    // Already removed, skip.
    return true;
  }
  if (!skipCheck && chatForm["keybase-chat"] !== undefined && chatForm["keybase-chat"].value != "") {
    if (!confirm("Discard your message?")) return false;
  }
  chatForm.parentNode.removeChild(chatForm);
  return true;
}


// Submit the chat widget
function submitChat(successCallback, e) {
  e.preventDefault();

  const f = e.currentTarget; // The form.
  const to = f["keybase-to"].value;
  const body = f["keybase-chat"].value;

  const nudgeDo = f["keybase-nudgecheck"]!==undefined && f["keybase-nudgecheck"].checked;
  const nudgeText = f["keybase-nudgetext"]!==undefined && f["keybase-nudgetext"].value;

  // TODO: Check that to/body are not empty.

  // We need this for when the chat widget gets detached from the DOM.
  const originalParent = f.parentNode;
  function nudgeCallback() {
    // Send nudge?
    if (!nudgeDo) return;

    const commentNode = findParentByClass(originalParent, "comment");
    if (!commentNode) return; // Not found

    postRedditReply(commentNode, nudgeText);
  }

  const submitButton = f["keybase-submit"];
  submitButton.disabled = true;
  submitButton.value = "Sending...";

  chrome.runtime.sendMessage({
    "method": "chat",
    "to": to,
    "body": body
  }, function(response) {
    if (response.status != "ok") {
      renderError(f, response.message);
      submitButton.value = "Try Again";
      submitButton.disabled = false;
      return;
    }

    removeChat(f, true /* skipCheck */);
    nudgeCallback();
    successCallback !== undefined && successCallback();
  });
}

// Render an error that replaces the body of the widget.
function renderErrorFull(el, bodyHTML) {
  el.innerHTML = `
    <h3><span class="keybase-close"> </span></h3>
    <p>
      <img src="${chrome.runtime.getURL("images/icon-keybase-logo-128.png")}" style="height: 64px; width: 64px;" />
    </p>
    ${bodyHTML}
  `;
  el.className = "keybase-error";
  //
  // Install closing button (the "x" in the corner)
  const closer = el.getElementsByClassName("keybase-close")[0];
  closer.addEventListener("click", function(e) {
    removeChat(el, true /* skipCheck */);
  });
}

// Render error message inside our chat widget.
function renderError(chatForm, msg) {
  const err = document.createElement("p");
  err.className = "keybase-error-msg";

  switch (msg) {
    case "Specified native messaging host not found.":
      return renderErrorFull(chatForm, `
        <p>You need the Keybase app to send chat messages.</p>
        <p>
          <a href="https://keybase.io/download" class="keybase-button" target="_blank">Install Keybase</a>
        </p>
      `);
    case "keybase is not running":
      return renderErrorFull(chatForm, `
        <p>Keybase needs to be running to send chat messages.</p>
        <p>
          <a href="https://keybase.io/reddit-crypto" class="keybase-button" target="_blank">More details</a>
        </p>
      `);
    case "keybase is not logged in":
      msg = "You need to log into the Keybase app to send chat messages.";
      break;
  }

  err.innerText = msg;
  const el = chatForm.getElementsByClassName("keybase-body")[0];
  el.appendChild(err);
}

// Post a Reddit thread reply on the given comment node.
function postRedditReply(commentNode, text) {
  // This will break if there is no reply button.
  const commentID = commentNode.getAttribute("data-fullname");
  const replyLink = commentNode.getElementsByClassName("reply-button")[0].firstChild;
  if (!commentID) {
    throw new ExtensionException("failed to find the comment ID");
  }

  // Open the reply window.
  replyLink.click();

  const replyForm = document.getElementById("commentreply_" + commentID);
  replyForm["text"].value = text;

  // Submit form

  // Note: Calling replyForm.submit() bypasses the onsubmit handler, so we
  // need to dispatch an event or click a submit button.
  replyForm.dispatchEvent(new Event("submit"));
}


/*** Helpers ***/

function ExtensionException(message) {
   this.name = 'ExtensionException';
   this.message = message;
}

// Find a parent with a given className.
function findParentByClass(el, className) {
  const root = el.getRootNode();
  while(el != root) {
    if (el.classList.contains(className)) return el;
    el = el.parentNode;
  }
  return null;
}

// Convert a user input into a string that is safe for inlining into HTML.
function safeHTML(s) {
  if (s===undefined) return "";
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
