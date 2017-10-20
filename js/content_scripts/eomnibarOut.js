/**
 * 负责iframe以及其外层shadowDOM的创建和事件处理
 *
 */
class EomnibarOut {
    constructor() {
        this.iframe = null;
        this.iframeWin = null;

        // Deprecated
        // conmmunicate with iframe
        //this.channel = new MessageChannel();
        //  port1 for reseive iframe's message
        //this.channel.port1.onmessage = (e) => {this.handleMessage(e)};

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('out.js onMessage addListener');
            if (request.action === 'hideOut') {
                this.hide();
            }
        });
        this.initIframe();
        this.initEvent();
    }

    /**
     * create shadow dom and iframe, append it to document
     * When iframe is loaded, initialize a message channel and pass port to
     * iframe
     *
     */
    initIframe() {
        console.log('EomnibarOut initIframe');

        // create shadow dom
        var shadowWrapper = document.createElement("div");
        shadowWrapper.id = 'myroot';
        const shadowDOM = shadowWrapper.createShadowRoot();

        // create shadowDOM style
        const url = chrome.extension.getURL("evernote_qs.css");
        const urlStar = chrome.extension.getURL("eomnibar.css");
        $(shadowDOM).append(`<style>
                                //iframe {display: none;}
                                @import url("${url}");
                                @import url("${urlStar}");
                            </style>`);

        // create iframe with given html
        const iframeURL = chrome.extension.getURL("eomnibar.html");
        const $iframe = $('<iframe src="' + iframeURL + '" seamless class="eomnibarFrame evernote_qsUIComponentHidden"></iframe>')
        this.iframe = $iframe;


        //const shadow = $('#myroot')[0].shadowRoot;
        //const ifr = $(shadow).find('iframe')[0];
        //$iframe.on('load', (e) => {
            //this.iframeWin = $iframe[0].contentWindow;
            //this.iframeWin.postMessage('Message: from main window', '*', [this.channel.port2]);
        //});

        $(shadowDOM).append($iframe);
        $('body').append(shadowWrapper);
    }

    initEvent() {
        $(document).click(() => {
            this.toggleIframeElementClasses('evernote_qsUIComponentVisible', 'evernote_qsUIComponentHidden');
        });
        $(document).keydown( (event) => {this.onKeydown(event)} );
    }

    onKeydown(event) {
        console.log('eomnibarOut keydown');
        const key = event.key;

        // won't capture keydown event if current focused target is input or textarea
        const tagName = event.target.tagName.toLowerCase();
        const isEditableInput = (tagName === 'input' && ['text', 'search'].indexOf(event.target.type.toLowerCase()) > -1);
        const isEditableDiv = (tagName === 'div' && event.target.contentEditable === 'true');
        if (isEditableInput || tagName === 'textarea' || isEditableDiv) {
            console.log('input or textarea');
            return;
        }

        if (key === 'E' || (event.shiftKey && key === 'e')) {
            this.forceNewTab = true;
            //this.channel.port1.postMessage('eomnibar_activateInNewTab');
            chrome.runtime.sendMessage({action: 'eomnibar_activateInNewTab'});
            this.toggleIframeElementClasses('evernote_qsUIComponentHidden', 'evernote_qsUIComponentVisible');
        } else if (key === 'e'){
            this.toggleIframeElementClasses('evernote_qsUIComponentHidden', 'evernote_qsUIComponentVisible');
        }
        this.iframe.focus();
    }

    toggleIframeElementClasses(removeClass, addClass) {
        this.iframe.removeClass(removeClass);
        return this.iframe.addClass(addClass);
    }

    hide() {
        this.toggleIframeElementClasses('evernote_qsUIComponentVisible', 'evernote_qsUIComponentHidden');
    }

    /**
     * Deprecated
     *
     * handle messages sent from iframe
     *
     * hide: hide the iframe
     * activate: activate the iframe
     *
     */
    handleMessage(e) {
        console.log(e.data);
        if (e.data === 'hide') {
            console.log('iframe hide');
            this.toggleIframeElementClasses('evernote_qsUIComponentVisible', 'evernote_qsUIComponentHidden');
        } else if (e.data === 'activate') {
            this.toggleIframeElementClasses('evernote_qsUIComponentHidden', 'evernote_qsUIComponentVisible');
        }
    }
}

$(document).ready(function(){
    var eomnibarOut = new EomnibarOut();
    chrome.runtime.sendMessage({action: 'loadAllNotes'});
});
