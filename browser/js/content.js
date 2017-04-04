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
    const buttons = c.getElementsByClassName("buttons")[0];

    renderChatButton(buttons, author);
  }
}

// Render the "keybase chat reply" button with handlers.
function renderChatButton(parent, toUsername) {
    const li = document.createElement("li");
    li.className = "keybase-reply";
    li.innerHTML = `<a href="keybase://${toUsername}@reddit/">keybase chat reply</a>`;

    li.getElementsByTagName("a")[0].addEventListener('click', function(e) {
      e.preventDefault();
      const forms = e.currentTarget.parentNode.getElementsByTagName("form");
      if (forms.length > 0) {
        // Chat widget already present, toggle it.
        removeChat(forms[0]);
        return;
      }
      renderChat(e.currentTarget.parentNode, toUsername);
    });

    parent.appendChild(li);
}

// Render the Keybase chat reply widget
function renderChat(parent, toUsername) {
  // TODO: Replace hardcoded HTML with some posh templating tech?
  // TODO: Prevent navigation?
  const isLoggedIn = document.getElementsByClassName("logout").length > 0;

  let nudgeHTML = `
    <p><label><input type="checkbox" name="keybase-nudge" checked /> <em>public</em> nudge (so they know about Keybase)</label></p>
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
    <h3>Keybase Chat <span class="keybase-close"> </span></h3>
    <input type="hidden" name="keybase-to" value="${toUsername}" />
    <p>Encrypt to <span class="keybase-username">${toUsername}</span>:</p>
    <p><textarea name="keybase-chat" rows="6"></textarea></p>
    ${nudgeHTML}
    <p><input type="submit" value="Send" name="keybase-submit" /></p> 
  `;
  f.addEventListener("submit", submitChat);
  parent.insertBefore(f, parent.firstChild);

  // Install nudge toggle
  const nudgeCheck = f["keybase-nudge"];
  if (nudgeCheck !== undefined) {
    // Select the <p><textarea>...</textarea></p>
    const nudgeText = nudgeCheck.parentNode.parentNode.nextElementSibling;
    nudgeCheck.addEventListener("change", function(e) {
      nudgeText.hidden = !e.currentTarget.checked;
    });
  }

  // Install closing button (the "x" in the corner)
  const closer = f.getElementsByClassName("keybase-close")[0];
  closer.addEventListener("click", function(e) {
    removeChat(f);
  });

  // TODO: Also add an onbeforeunload check if chat has text written in it.
}

// Remove the chat widget from the DOM
function removeChat(chatForm, skipCheck) {
  if (!chatForm.parentNode) {
    // Already removed, skip.
    return;
  }
  if (!skipCheck && chatForm["keybase-chat"].value != "") {
    if (!confirm("Discard your message?")) return;
  }
  chatForm.parentNode.removeChild(chatForm);
}


// Submit the chat widget
function submitChat(e) {
  e.preventDefault();

  const f = e.currentTarget; // The form.
  const to = f["keybase-to"].value;
  const body = f["keybase-chat"].value;
  const nudgeDo = f["keybase-nudge"].checked;
  const nudgeText = f["keybase-nudgetext"].value;

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

  const port = chrome.runtime.connect();
  port.postMessage({
    "method": "chat",
    "to": to + "@reddit",
    "body": body
  });
  port.onMessage.addListener(function(response) {
    if (response.status != "ok") {
      renderError(f, response.message);
      submitButton.value = "Error";
      return;
    }

    removeChat(f, true /* skipCheck */);
    nudgeCallback();
  });
}

// Render error message inside our chat widget.
function renderError(chatForm, msg) {
  const p = document.createElement("p");
  p.className = "keybase-error";
  p.innerText = msg;
  chatForm.appendChild(p);
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
