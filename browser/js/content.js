// This code gets included just for when the extension injects the
// widget-rendering code into some page.
"use strict";

const bel = bundle.bel;
const morphdom = bundle.morphdom;
const asset = chrome.runtime.getURL;


function init() {
  chrome.storage.sync.get(function(options) {
    if (options === undefined) {
      // Backfill for Firefox
      options = {};
    }
    if (location.hostname.endsWith('twitter.com')) {
      // Twitter hack: Monitor location for changes and re-init. Twitter does
      // weird single-page-app stuff that makes it difficult to hook into.
      // FIXME: This is sad. An alternative would be very desireable.
      // Subscribing to `popstate` does not work.
      let loc = window.location.pathname;
      function twitterMonitor() {
        if (window.location.pathname == loc) {
          requestAnimationFrame(function() {
            // We use RAF to avoid spamming checks when the tab is not active.
            setTimeout(twitterMonitor, 1000);
          });
          return;
        }
        // Path changed, force fresh init
        init();
      }
      setTimeout(twitterMonitor, 1000);
    }

    const user = matchService(window.location, document);

    // Passive queries?
    if (options["profile-passive-queries"] === true && user) { // undefined defaults to false
      chrome.runtime.sendMessage({
        "method": "passivequery",
        "to": user.query(),
      }, function(response) {
        if (response.status !== "ok") return;
        user.services["keybase"] = safeHTML(response.result["username"]);
      });
    }

    // Inject Reddit replies?
    if (options["reddit-thread-reply"] !== false) { // undefined defaults to true
      if (location.hostname.endsWith('.reddit.com') && redditCheckThread.test(location.pathname)) {
        redditInjectThread(document);
      }
    }

    // Inject profile chat buttons?
    if (options["profile-chat-buttons"] !== false && user) { // undefined defaults to true
      injectProfileChat(user);
    }
  });
}
window.addEventListener('load', init);

// Global state of which chat window is currently open.
let openChat = null;

// General renderers:

// Render the "Encrypt to..." contact header for the chat widget.
function renderChatContact(el, user) {
  const keybaseUsername = user.services["keybase"];
  let queryStatus, iconSrc;
  if (keybaseUsername) {
    queryStatus = bel`
      <small>
        <a class="keybase-user" href="https://keybase.io/${keybaseUsername}" target="_blank">
          <span>${keybaseUsername}</span>
        </a> on Keybase
      </small>
    `;
    iconSrc = bel`<img class="keybase-icon" src="https://keybase.io/${keybaseUsername}/picture?serve_placeholder=1" />`;
  } else {
    queryStatus = bel`<small>Searching...</small>`;
    if (keybaseUsername === null) {
      queryStatus = bel`<small>(Not yet on Keybase)</small>`;
    }
    iconSrc = bel`
      <img class="keybase-icon"
           src="${asset("images/icon-placeholder-avatar-32.png")}"
           srcset="${asset("images/icon-placeholder-avatar-32@2x.png")} 2x, ${asset("images/icon-placeholder-avatar-32@3x.png")} 3x"
           />
    `;
  }
  morphdom(el, bel`
    <div class="keybase-contact">
      <div>${iconSrc}</div>
      Encrypt to <a class="keybase-user ${user.origin}" href="${user.href()}" target="_blank">${user.display()}</a>
      ${queryStatus}
    </div>
  `);
}

// Render the nudge messaging for when the user is not on keybase.
function renderNudge(user, nudgeSupported) {
  if (nudgeSupported) {
    return bel`
      <div class="keybase-nudge">
        <p>
          <label><input type="checkbox" name="keybase-nudgecheck" checked /> <strong>Nudge publicly</strong> (reply in thread so they know about Keybase)</label>
          <textarea name="keybase-nudgetext">${user.display()} - I left you an end-to-end encrypted reply in Keybase. https://keybase.io/reddit-crypto</textarea>
        </p>
      </div>
    `;
  }

  const el = bel`
    <div class="keybase-nudge">
      <p>
        You will need to let <a target="_blank" href="${user.href()}" class="external-user">${user.display()}</a> know that they have a Keybase message waiting for them.
      </p>
      <p>
        Share this handy link: <span class="keybase-copy">https://keybase.io/docs/extension</span>
      </p>
    </div>
  `;

  // Install copypasta selector
  installCopypasta(el.getElementsByClassName("keybase-copy"));

  return el;
}

// Render the Keybase chat reply widget
function renderChat(parent, user, nudgeSupported, closeCallback) {
  // The chat widget is enclosed in the form element.
  const f = bel`<form class="keybase-reply" action="#">
    <h3>
      <img src="${asset("images/icon-keybase-logo-16.png")}"
           srcset="${asset("images/icon-keybase-logo-16@2x.png")} 2x, ${asset("images/icon-keybase-logo-16@3x.png")} 3x"
           />
      Keybase Chat <span class="keybase-close"> </span>
    </h3>
    <div class="keybase-body">
      <div class="keybase-contact"></div>
      <input type="hidden" name="keybase-to" value="${user.query()}" />
      <label>
        <textarea name="keybase-chat" rows="6" placeholder="Write a message" autofocus></textarea>
      </label>
      <div class="keybase-nudge" style="display: none;"></div>
      <p style="text-align: center; clear: both;"><input type="submit" value="Send" name="keybase-submit" /></p>
    </div>
  `;

  function successCallback() {
    let successHTML;
    if (!nudgeSupported && !user.services["keybase"]) {
      successHTML = renderNudge(user);
    }
    renderSuccess(f, closeCallback, successHTML);
  }

  f.addEventListener("submit", submitChat.bind(null, successCallback));
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
      renderError(f, closeCallback, response.message);
    } else if (user.origin === "keybase") {
      renderError(f, closeCallback, "invalid profile");
      return;
    }

    user.services["keybase"] = null;
    renderChatContact(contactDiv, user);
    morphdom(nudgePlaceholder, renderNudge(user, nudgeSupported));

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
      typeof closeCallback === "function" && closeCallback();
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

  // Force focus the chat textarea (should already be done by autofocus)
  f["keybase-chat"].focus();

  // TODO: Also add an onbeforeunload check if chat has text written in it.
  return f;
}

// Remove the chat widget from the DOM
function removeChat(chatForm, skipCheck) {
  if (!chatForm || !chatForm.parentNode) {
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
      renderError(f, null, response.message);
      submitButton.value = "Try Again";
      submitButton.disabled = false;
      return;
    }

    // Success!
    nudgeCallback();
    typeof successCallback === "function" && successCallback();
  });
}

// Render a success screen which replaces the body of the widget.
function renderSuccess(el, closeCallback, extraHTML) {
  morphdom(el, bel`
    <div>
      <h3>
        <img src="${asset("images/icon-keybase-logo-16.png")}"
             srcset="${asset("images/icon-keybase-logo-16@2x.png")} 2x, ${asset("images/icon-keybase-logo-16@3x.png")} 3x"
             />
        Keybase Chat <span class="keybase-close"> </span>
      </h3>
      <div class="keybase-body">
        <p>
          <img src="${asset("images/icon-fancy-chat-72-x-52.png")}" style="width: 72px; height: 52px;"
               srcset="${asset("images/icon-fancy-chat-72-x-52@2x.png")} 2x, ${asset("images/icon-fancy-chat-72-x-52@3x.png")} 3x"
               />
        </p>
        <p>
          Chat sent! You can continue the conversation in your Keybase app.
        </p>
        ${extraHTML}
        <p>
          <input type="button" class="keybase-close" value="Close" />
        </p>
      </div>
    </div>
  `, {childrenOnly: true});
  el.classList.add("keybase-success");

  installCloser(el.getElementsByClassName("keybase-close"), el, true /* skipCheck */, closeCallback);
}

// Render an error that replaces the body of the widget.
function renderErrorFull(el, closeCallback, bodyHTML) {
  morphdom(el, bel`
    <div>
      <h3><span class="keybase-close"> </span></h3>
      <p>
        <img src="${asset("images/icon-keybase-logo-128.png")}" style="height: 64px; width: 64px;" />
      </p>
      ${bodyHTML}
    </div>
  `, {childrenOnly: true});
  el.classList.add("keybase-error");

  installCloser(el.getElementsByClassName("keybase-close"), el, true /* skipCheck */, closeCallback);
}

// Render error message inside our chat widget.
function renderError(chatForm, closeCallback, msg) {
  if (msg.includes("keybased.sock: connect:")) {
    msg = "keybase is not running";
  }

  switch (msg) {
    case "Specified native messaging host not found.":
    case "Attempt to postMessage on disconnected port":
      return renderErrorFull(chatForm, closeCallback, bel`
        <div>
          <p>You need the Keybase app to send chat messages.</p>
          <p>
            <a href="https://keybase.io/download" class="keybase-button" target="_blank">Install Keybase</a>
          </p>
        </div>
      `);
    case "keybase is not running":
      return renderErrorFull(chatForm, closeCallback, bel`
        <div>
          <p>Keybase needs to be running to send chat messages.</p>
          <p>
            <a href="https://keybase.io/docs/extension" class="keybase-button" target="_blank">More details</a>
          </p>
        </div>
      `);
    case "invalid profile":
      return renderErrorFull(chatForm, closeCallback, bel`
        <div>
          <p>Keybase Chat only works on profile pages.</p>
        </div>
      `);
    case "keybase is not logged in":
      msg = "You need to log into the Keybase app to send chat messages.";
      break;
  }

  const err = bel`
    <p class="keybase-error-msg">${msg}</p>
  `;
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

// Install closing button (usually the little "x" in the corner)
function installCloser(buttons, closeTarget, skipCheck, closeCallback) {
  for (let closer of buttons) {
    closer.addEventListener("click", function(e) {
      e.preventDefault();
      if (removeChat(closeTarget, skipCheck)) {
        typeof closeCallback === "function" && closeCallback();
      }
    });
  };
}

// Install select-and-copy functionality for elements. If successfully copied,
// the element will get the CSS class "copied" briefly.
function installCopypasta(elements) {
  for (let el of elements) {
    el.addEventListener("click", function(e) {
      const target = e.currentTarget;
      const range = document.createRange();
      range.selectNode(target);

      // Apply range selection
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      // Attempt to copy to clipboard
      if(document.execCommand("copy")) {
        target.classList.add("copied");
        setTimeout(function() {
          target.classList.remove("copied");
        }, 500);
      }
    });
  }
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
