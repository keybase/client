chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    console.log(tabs);
    const location = new URL(tabs[0].url);

    if (location.hostname.endsWith('reddit.com')) {
        const username = location.pathname.split('/')[2];
        renderPopup(document.body, username);
    } else if (location.hostname.endsWith('twitter.com')) {
        const username = location.pathname.split('/')[1];
        renderPopup(document.body, username);
    }
})

function renderPopup(el, username) {
    const div = document.createElement("div");
    div.className = "keybase-reply";
    el.appendChild(div);

    renderChat(div, username, function closeCallback() {
        window.close();
    });
}

