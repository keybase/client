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
  const f = document.createElement("form");
  f.innerHTML = '\
    <p>Encrypt to <span class="keybase-username">'+ toUsername +'</span>:</p>\
    <p><textarea name="keybase-chat"></textarea></p>\
    <p><input type="checkbox" name="keybase-nudge" /> <em>public</em> nudge (so they know about Keybase)</p>\
    <p><textarea name="keybase-nudge">/u/'+ toUsername + ' - I left you an end-to-end encrypted replace in Keybase. https://keybase.io/reddit-crypto</textarea></p>\
    <p><input type="submit" /></p> \
  ';
  f.addEventListener('submit', submitChat);
  parent.insertBefore(f, parent.firstChild);
}

function submitChat(e) {
  e.currentTarget.parentNode.removeChild(e.currentTarget);
  console.log("Chat submitted: ", e);
}
