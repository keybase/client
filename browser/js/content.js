function init() {
  // Only do work on reddit.
  if (!location.hostname.endsWith('.reddit.com')) return;

  // FIXME: This can be more declarative in the future.
  if (checkCompose.test(location.pathname)) InjectCompose();
  else if (checkProfile.test(location.pathname)) InjectProfile();
  else if (checkThread.test(location.pathname)) InjectThread();
}


const checkCompose = /^\/message\/compose$/
function InjectCompose() {
  // /message/compose
  // TODO: ...
  console.log("keybase: On compose.");
}

const checkProfile = /^\/user\//;
function InjectProfile() {
  // /user/<user>
  // TODO: ...
  console.log("keybase: On profile.");
}

const checkThread = /^\/r\/\w+\/comments\/\w+\//;
function InjectThread() {
  // /r/<subreddit>/comments/<id>/<slug>
  console.log("keybase: On thread.");

  for (let c of document.getElementsByClassName("comment")) {
    const author = c.getAttribute("data-author");
    const buttons = c.getElementsByClassName("buttons")[0];

    const li = document.createElement("li");
    li.className = "keybase-reply";
    li.innerHTML = "<a href=\"keybase://"+ author +"@reddit/\">keybase chat reply</a>";
    buttons.appendChild(li);
  }
}


window.addEventListener('load', init);
