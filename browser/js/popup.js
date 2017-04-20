
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const location = new URL(tabs[0].url);

    switch (location.hostname) {
        case 'www.reddit.com':
            processReddit(location.pathname);
            break;
    }
})

function processReddit(path) {
    const username = path.split('/')[2];
    renderPopup(document.body, username);
}

function renderPopup(el, username) {
    const div = document.createElement("div");
    div.className = "keybase-reply";
    el.appendChild(div);

    renderChat(div, username);
}

