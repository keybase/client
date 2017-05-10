// This code gets included just for the popup when the extension icon is clicked.
"use strict";

// Parse the location.search query string

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const location = new URL(tabs[0].url);
    const el = document.body;

    // Clear children
    while (el.firstChild) el.removeChild(el.firstChild);

    const user = matchService(location);
    return renderPopup(el, user);
});

function renderPopup(el, user) {
    const div = document.createElement("div");
    div.className = "keybase-reply";
    el.appendChild(div);

    const f = renderChat(div, user, false /* nudgeSupported */, function closeCallback() {
        window.close();
    });

    // Sigh: This is a sad hack because the popup's DOM state seems to be
    // unpredictable and our normal imperative stuff doesn't always work
    // in the initial rendering phase so this is a workaround:
    setTimeout(function() {
        // Select the textarea. Seems the popup overrides the default selected
        // element, maybe because you're clicking on an icon to achieve it.
        f["keybase-chat"].focus();

        // Resize the window a tiny bit which forces a subtle rerender that
        // fixes a bug where the popup is rendered in the wrong size initially
        // sometimes.
        document.body.style.height = window.innerHeight + 1 + "px";
        setTimeout(function() {
            // We can't remove the property too soon or otherwise it happens
            // before the popup render glitch. We'd rather not keep it either
            // because the size of our widget can change after some UI flows.
            document.body.style.removeProperty("height");
        }, 100);
    }, 200);
}
