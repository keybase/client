chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const location = new URL(tabs[0].url);

    if (location.hostname.endsWith('reddit.com')) {
        const username = location.pathname.split('/')[2];
        renderPopup(document.body, username, 'reddit');
    } else if (location.hostname.endsWith('twitter.com')) {
        const username = location.pathname.split('/')[1];
        renderPopup(document.body, username, 'twitter');
    }
})

function renderPopup(el, username, service) {
    const div = document.createElement("div");
    div.className = "keybase-reply";
    el.appendChild(div);

    const user = new User(username, service)
    renderChat(div, user, false /* nudgeSupported */, function closeCallback() {
        window.close();
    });
}

