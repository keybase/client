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
  console.log("keybase: On compose.");
}

const checkProfile = /^\/user\//;
function injectProfile() {
  // /user/<user>
  // TODO: ...
  console.log("keybase: On profile.");
}

const checkThread = /^\/r\/\w+\/comments\/\w+\//;
function injectThread() {
  // /r/<subreddit>/comments/<id>/<slug>
  console.log("keybase: On thread.");

  for (let c of document.getElementsByClassName("comment")) {
    const author = c.getAttribute("data-author");
    const buttons = c.getElementsByClassName("buttons")[0];

    const li = document.createElement("li");
    li.className = "keybase-reply";
    li.innerHTML = "<a href=\"keybase://"+ author +"@reddit/\">keybase chat reply</a>";
    buttons.appendChild(li);

    li.getElementsByTagName("a")[0].addEventListener('click', function(e) {
      renderChat(e.currentTarget.parentNode, author);
      e.preventDefault();
    });

  }
}


function renderChat(parent, toUsername) {
  // TODO: Cancel button
  // TODO: Prevent navigation?
  const isLoggedIn = document.getElementsByClassName("logout").length > 0;

  let nudgeHTML = '\
    <p><label><input type="checkbox" name="keybase-nudge" checked /> <em>public</em> nudge (so they know about Keybase)</label></p>\
    <p><textarea name="keybase-nudgetext">/u/'+ toUsername + ' - I left you an end-to-end encrypted reply in Keybase. https://keybase.io/reddit-crypto</textarea></p>\
  ';
  if (!isLoggedIn) {
    // FIXME: Won't need this if we have a KeybaseBot PM'ing people?
    nudgeHTML = '\
      <p>You will need to let <a target="_blank" href="/u/'+ toUsername +'" class="reddit-user">/u/' + toUsername + '</a> know that they have a Keybase message waiting for them.</p>\
      <p>Share this handy link: <a target="_blank" href="https://keybase.io/reddit-crypto">https://keybase.io/reddit-crypto</a></p>\
    ';
  }

  // The chat widget is enclosed in the form element.
  const f = document.createElement("form");
  f.action = "#"; // Avoid submitting even if we fail to preventDefault
  f.innerHTML = '\
    <h3>Keybase Chat</h3>\
    <input type="hidden" name="keybase-to" value="'+ toUsername +'" />\
    <p>Encrypt to <span class="keybase-username">'+ toUsername +'</span>:</p>\
    <p><textarea name="keybase-chat" rows="6"></textarea></p>\
    '+ nudgeHTML +'\
    <p><input type="submit" value="Send" /></p> \
  ';
  f.addEventListener('submit', submitChat);
  parent.insertBefore(f, parent.firstChild);
}

function submitChat(e) {
  e.preventDefault();

  const to = e.currentTarget["keybase-to"].value;
  const body = e.currentTarget["keybase-chat"].value;
  const nudgeDo = e.currentTarget["keybase-nudge"].checked;
  const nudgeText = e.currentTarget["keybase-nudgetext"].value;

  // TODO: Check that to/body are not empty.

  const port = chrome.runtime.connect();
  port.postMessage({
    "method": "chat",
    "to": to + "@reddit",
    "body": body
  });
  port.onMessage.addListener(function(response) {
    console.log("response: ", response);
  });

  // TODO: Send nudge

  // Detach the chat widget from the parent.
  e.currentTarget.parentNode.removeChild(e.currentTarget);
  console.log("Chat submitted: ", e);
}
