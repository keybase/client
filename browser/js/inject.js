"strict";

// Check if there is an inline button already available for us to swap. Used
// before adding our own button.
function installExistingButtons(user) {
  const preinstalled = document.getElementsByClassName("keybase-chat-open");
  if (!preinstalled.length) return false;

  installChatButton(preinstalled, user);
  return true;
}

function injectProfileChat(user) {
  const injectFn = profileInject[user.origin];
  if (injectFn === undefined) return;

  // Check if there is an inline button already available for us to swap. Used
  // before adding our own button.
  const preinstalled = document.getElementsByClassName("keybase-chat-open");
  if (preinstalled.length) {
    installChatButton(preinstalled, user);
    return;
  }

  // Check if there is already a button injected?
  if (document.querySelector(".keybase-chat")) return;

  injectFn(user);
}

// Site-specific DOM injectors, does not get used in the popup.

const profileInject = {
  "keybase": function keybaseInjectProfile(user) {
    // Keybase button is special to fit our UI until we get a placeholder to
    // install into. This should be removed when we get a native button to use.
    for (const wrapper of document.querySelectorAll(".track-action-wrapper")) {
      const button = renderProfileChatButton(user);
      button.className = "btn btn-md btn-default keybase-profile-chat";

      const lastButton = wrapper.children[wrapper.children.length-1];
      wrapper.insertBefore(button, lastButton);
    }
  },
  "facebook": function facebookInjectProfile(user) {
    const container = document.querySelector("#fbProfileCover .actions");
    if (!container) return;

    user.extraReplyCls = "fixed-form"
    const button = renderProfileChatButton(user);
    container.insertBefore(button, container.firstChild);
  },

  "reddit": function redditInjectProfile(user) {
    const designV1 = document.querySelector("h1");
    const designV2 = document.querySelector("h4");
    const container = designV1 || designV2.nextSibling;
    if (!container) return;

    if (designV2) {
      user.extraReplyCls = "fixed-form"
    }
    const button = renderProfileChatButton(user);
    button.style = "display: block; margin: 4px 0;";
    container.parentNode.insertBefore(button, container.nextSibling);
  },

  "twitter": function twitterInjectProfile(user) {
    const container = document.querySelector(".ProfileHeaderCard-screenname");
    if (!container) return;

    const button = renderProfileChatButton(user);
    button.style = "margin-top: 4px;";
    container.appendChild(button, container);
  },

  "github": function githubInjectProfile(user) {
    const container = document.querySelector(".vcard-names");
    if (!container) return;

    const button = renderProfileChatButton(user);
    container.appendChild(button);
  },

  "hackernews": function hackernewsInjectProfile(user) {
    const tables = document.getElementsByTagName("tbody");
    const profileTable = tables[tables.length-1];

    // Add a "chat" button next to username
    const userLink = profileTable.children[0].children[1];
    const button = renderProfileChatButton(user);
    button.style = "margin: 4px 0; display: block;"

    userLink.appendChild(button);
  },
}

function renderProfileChatButton(user) {
  const icon = document.createElement("img");
  icon.src = `${asset("images/icon-keybase-logo-16.png")}`;
  icon.srcset = `${asset("images/icon-keybase-logo-16@2x.png")} 2x, ${asset("images/icon-keybase-logo-16@3x.png")} 3x`;

  const button = document.createElement("a");
  button.className = "keybase-chat";
  button.appendChild(icon);
  button.appendChild(document.createTextNode("Keybase Chat"));

  installChatButton([button], user);
  return button;
}

const redditCheckThread = /^\/r\/\w+\/comments\/\w+\//;
function redditInjectThread(parent) {
  // /r/<subreddit>/comments/<id>/<slug>
  for (const c of parent.getElementsByClassName("comment")) {
    const author = safeHTML(c.getAttribute("data-author"));
    if (author == "") continue; // Empty
    const buttons = c.getElementsByClassName("buttons")[0];

    buttons.appendChild(redditRenderChatButton(author));
  }
}

// Render the "keybase chat reply" button with handlers.
function redditRenderChatButton(toUsername) {
  const isLoggedIn = document.getElementsByClassName("logout").length > 0;
  const user = new User(toUsername, "reddit");
  const li = document.createElement("li");
  li.className = "keybase-reply";

  const button = document.createElement("a");
  button.appendChild(document.createTextNode("keybase chat reply"));
  li.appendChild(button);

  installChatButton([button], user, isLoggedIn);
  return li;
}

// Install chat button opening
function installChatButton(buttons, user, nudgeSupported) {
  for (let b of buttons) {
    if (b.style.display === "none") {
      // Make the button visible if it's hidden
      b.style = "display: inline-block !important;";
    }

    b.addEventListener('click', function(e) {
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

      openChat = renderChat(chatParent, user.clone(), nudgeSupported);

      // Is the widget exceeding our window width?
      if (openChat.offsetLeft + openChat.clientWidth > window.innerWidth) {
        openChat.style = `margin-left: -${openChat.clientWidth + 10}px`;
      }
    });
  }
}

