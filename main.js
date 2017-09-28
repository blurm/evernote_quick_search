$(document).ready( () => {
    //var controller = new Controller();
    var controller = chrome.extension.getBackgroundPage().eomnibarController;
    $('#login').click(() => {
        const backgroundPort = chrome.runtime.connect({name: 'eomnibarPort'});
        backgroundPort.postMessage({action: 'loginWithEvernote'});
        //backgroundPort.onMessage.addListener((msg) => {
            //console.log(msg);
        //});
    });
    //$('#logout').click(() => controller.logout());

    chrome.i18n.getAcceptLanguages((list) => {
        if ('zh-CN' === list[0]) {
            $('#deviceready a').text('授权访问印象笔记');
        } else {
            $('#deviceready a').text('Authorize to Access Evernote');
        }
    });
} );

