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

// Global state of which chat window is currently open.
let openChat = null;

// Render the "keybase chat reply" button with handlers.
function renderChatButton(parent, toUsername) {
    const li = document.createElement("li");
    li.className = "keybase-reply";
    li.innerHTML = `<a href="keybase://${toUsername}@reddit/">keybase chat reply</a>`;

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

      openChat = renderChat(chatParent, toUsername);
    });

    parent.appendChild(li);
}

// Render the Keybase chat reply widget
function renderChat(parent, toUsername) {
  // TODO: Replace hardcoded HTML with some posh templating tech?
  // TODO: Prevent navigation?
  const isLoggedIn = document.getElementsByClassName("logout").length > 0;

  let nudgeHTML = `
    <p><label><input type="checkbox" name="keybase-nudgecheck" checked /> Nudge publicly (reply in thread so they know about Keybase)</label></p>
    <p><textarea name="keybase-nudgetext">/u/${toUsername} - I left you an end-to-end encrypted reply in Keybase. https://keybase.io/reddit-crypto</textarea></p>
  `;
  if (!isLoggedIn) {
    // FIXME: Won't need this if we have a KeybaseBot PM'ing people?
    nudgeHTML = `
      <p>You will need to let <a target="_blank" href="/u/${toUsername}" class="reddit-user">/u/${toUsername}</a> know that they have a Keybase message waiting for them.</p>
      <p>Share this handy link: <a target="_blank" href="https://keybase.io/reddit-crypto">https://keybase.io/reddit-crypto</a></p>
    `;
  }

  // The chat widget is enclosed in the form element.
  const f = document.createElement("form");
  f.action = "#"; // Avoid submitting even if we fail to preventDefault
  f.innerHTML = `
    <h3><img src="${chrome.runtime.getURL("images/icon-keybase-logo-48.png")}" />Keybase chat <span class="keybase-close"> </span></h3>
    <div class="keybase-body">
      <input type="hidden" name="keybase-to" value="${toUsername}" />
      <label>
        Encrypt to ${renderUser(toUsername, "reddit.com/u")}</span>:
        <p>
          <textarea name="keybase-chat" rows="6" placeholder="Write a message"></textarea>
        </p>
      </label>
      <div class="keybase-nudge">
        <p>Checking Keybase...</p>
      </div>
      <p style="text-align: center;"><input type="submit" value="Send" name="keybase-submit" /></p> 
    </div>
  `;
  f.addEventListener("submit", submitChat);
  parent.insertBefore(f, parent.firstChild);

  // Find user
  const nudgePlaceholder = f.getElementsByClassName("keybase-nudge")[0];
  chrome.runtime.sendMessage({
    "method": "query",
    "to": toUsername + "@reddit"
  }, function(response) {
    if (response.status == "ok") {
      const keybaseUsername = safeHTML(response.result["username"]);
      nudgePlaceholder.innerHTML = `<p><img class="keybase-icon" src="https://keybase.io/${keybaseUsername}/picture" /> ${renderUser(toUsername, "reddit.com/u")} is ${renderUser(keybaseUsername, "keybase.io")}</p>`;
      return;
    } else if (response.message != "user not found") {
      renderError(f, response.message);
    }
    nudgePlaceholder.innerHTML = nudgeHTML;

    // Install nudge toggle
    const nudgeCheck = f["keybase-nudgecheck"];
    if (nudgeCheck !== undefined) {
      // Select the <p><textarea>...</textarea></p>
      const nudgeText = nudgeCheck.parentNode.parentNode.nextElementSibling;
      nudgeCheck.addEventListener("change", function(e) {
        nudgeText.hidden = !e.currentTarget.checked;
      });
    }
  });

  // Install closing button (the "x" in the corner)
  const closer = f.getElementsByClassName("keybase-close")[0];
  closer.addEventListener("click", function(e) {
    removeChat(f);
  });

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
function submitChat(e) {
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

    postReply(commentNode, nudgeText);
  }

  const submitButton = f["keybase-submit"];
  submitButton.disabled = true;
  submitButton.value = "Sending...";

  chrome.runtime.sendMessage({
    "method": "chat",
    "to": to + "@reddit",
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

// Render a formatted user@service string.
function renderUser(username, service) {
  if (service=="undefined") {
    service = "keybase.io";
  }
  return `<a class="keybase-user" href="https://${service}/${username}" target="_blank">${service}/<span>${username}</span></a>`;
}

// Post a Reddit thread reply on the given comment node.
function postReply(commentNode, text) {
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
