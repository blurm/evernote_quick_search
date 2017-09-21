console.log('eventPage executed');
//var controller = new Controller();
chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({url:"main.html"})
});

