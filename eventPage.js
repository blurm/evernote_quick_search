// event page 维护Controller的实例，供其他content script通过connect port调用
var eomnibarController = new Controller();

// Long-lived connections
chrome.runtime.onConnect.addListener(function(port) {
    if (port.name == 'eomnibarPort') {
        port.onMessage.addListener(function(msg) {
            console.log(msg);
            if (msg.action === 'performSearch') {
                const suggestions = eomnibarController.performSearch(
                    msg.queryString, msg.maxSuggestion);
                port.postMessage({queryString: msg.queryString, suggestions: suggestions});
            } else if (msg.action === 'loginWithEvernote') {
                eomnibarController.loginWithEvernote();
            }
        });
    }
});

// Simple one-time requests
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'hide') {
        console.log('hide the iframe');
        //chrome.runtime.sendMessage({action: 'hideOut'});
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'hideOut'});
        });
    }
    if (request.action === 'loadAllNotes') {
        eomnibarController.loadAllNotes();
    }
    //if (request.action === 'eomnibar_activateInNewTab') {
        //console.log('activateInNewTab eventPage');
    //}
    if (request.action === 'openInNewTab') {
        chrome.tabs.create({url: request.url});
    } else if (request.action === 'openInCurrentTab'){
        chrome.tabs.update({url: request.url});
    }
});

chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({url:"main.html"});
});

