class Vomnibar {
    constructor(controller) {
        this.controller = controller;

        this.iframe = null;
        this.vomnibarDOM = null;
        this.completionUl = null;
        this.input = null;

        this.suggestions = [];
        this.selection = 0;
        this.forceNewTab = false;
        this.openInNewTab = false;

        this.init();
    }

    init() {
        this.initIframe();
    }

    initIframe() {
        // create shadow dom
        var shadowWrapper = document.createElement("div");
        shadowWrapper.id = 'myroot';
        const shadowDOM = shadowWrapper.createShadowRoot();

        // create shadowDOM style
        const url = chrome.extension.getURL("vimium.css");
        const urlStar = chrome.extension.getURL("vomnibar.css");
        $(shadowDOM).append(`<style>@import url("${url}");
                                    @import url("${urlStar}");
                            </style>`);

        // create iframe with given html
        const iframeURL = chrome.extension.getURL("vomnibar.html");
        const $iframe = $('<iframe src="' + iframeURL + '" seamless class="vomnibarFrame"></iframe>')
        $(shadowDOM).append($iframe);

        $('body').append(shadowWrapper);

        $(shadowDOM).find('iframe').on('load', () => {
            console.log('loaded');
            const shadow = $('#myroot')[0].shadowRoot;
            const $iframe = $(shadow).find('.vomnibarFrame');
            const $iframeContent = $($iframe[0].contentDocument);
            const $vomnibar = $iframeContent.find('#vomnibar');

            this.iframe = $iframe;
            this.vomnibarDOM = $vomnibar;
            this.completionUl = this.vomnibarDOM.find('ul');
            this.input = this.vomnibarDOM.find('input');

            this.hide();
            this.initDom();
        });
    }

    initDom() {
        $(window).focus( () => {this.input.focus()} );
        this.input.on('input', (event) => {this.onInput(event)});
        this.input.keydown( (event) => { this.onActionKeydown(event) } )
        $(document).click(() => {this.hide()});
        $(document).keydown( (event) => {this.onKeydown(event)} );
        $(this.vomnibarDOM).click( (event) => {event.stopPropagation()} );
    }

    onInput(event) {
        const $completionList = this.vomnibarDOM.find('ul');
        this.completionUl.empty();

        // 所有匹配的选项
        const queryString = event.currentTarget.value;
        const suggestions = this.controller.performSearch(queryString);
        this.suggestions = suggestions;
        this.selection = 0;


        let htmlItems = '';
        for (let i in suggestions) {
            const index = parseInt(i);
            if (index === this.selection) {
                htmlItems += '<li class="vomnibarSelected">' + this.generateItems(suggestions[index], queryString.trim()) + '</li>';
            } else {
                htmlItems += '<li>' + this.generateItems(suggestions[index], queryString.trim()) + '</li>';
            }
        }

        if (suggestions.length === 0) {
            this.completionUl.hide();
        } else {
            this.completionUl.append(htmlItems);
            this.completionUl.show();
        }
    }

    onKeydown(event) {
        console.log('document keydown');
        const key = event.key;
        if (key === 'E' || (event.shiftKey && key === 'e')) {
            this.forceNewTab = true;
            this.iframe.removeClass('vimiumUIComponentHidden');
        } else if (key === 'e'){
            this.iframe.removeClass('vimiumUIComponentHidden');
        }
        this.iframe.focus();
        this.input.focus();
    }

    onActionKeydown(event) {
        const action = this.actionFromKeyEvent(event);
        if (!action) {
            return true;
        }
        console.log('action keydown', action);

        // 是否在新窗口打开笔记
        this.openInNewTab = event.ctrlKey || event.shiftKey || this.forceNewTab;

        // E or e 打开笔记搜索框
       if (action === 'down') {
            if (0 < this.suggestions.length) {
                this.selection += 1;
                if (this.suggestions.length === this.selection) {
                    this.selection = 0;
                }
                this.updateSelection();
            }
        } else if (action === 'up') {
            this.selection -= 1;
            if (this.selection < 0) {
                this.selection = this.suggestions.length -1;
            }
            this.updateSelection();
        } else if (action === 'dismiss') {
            //this.iframe.addClass('vimiumUIComponentHidden');
            this.hide();
        } else if (action === 'enter') {
            const curSuggestion = this.suggestions[this.selection];
            if (this.openInNewTab) {
                chrome.tabs.create({url: curSuggestion.url});
            } else {
                chrome.tabs.update({url: curSuggestion.url});
            }
        }
        event.stopImmediatePropagation()
        event.preventDefault()
    }

    actionFromKeyEvent(event) {
        const key = event.key;
        if (key === 'Escape' || (event.ctrlKey && key === '[')) {
            return 'dismiss';
        } else if (key == 'up' ||
            (event.shiftKey && event.key == "Tab") ||
            (event.ctrlKey && (key == "k" || key == "p"))) {
            return 'up';
        } else if (event.key == "Tab" && !event.shiftKey) {
            return 'down';
        } else if (key == "down" ||
            (event.ctrlKey && (key == "j" || key == "n"))) {
            return 'down';
        } else if (event.key == "Enter") {
            return 'enter';
        }
        //else if(["Backspace", "Delete"].includes(key)) {
            //return "delete"
        //}
    }

    hide() {
        this.reset();
    }

    reset() {
        this.iframe.addClass('vimiumUIComponentHidden');
        this.input.val('');
        this.completionUl.empty();
        this.completionUl.hide();
        // 需要将焦点从iframe移出，否则任然会触发onInput
        this.iframe.blur();
        //@clearUpdateTimer()
        //@previousInputValue = null
        //@customSearchMode = null
        //@selection = @initialSelectionValue
        //@keywords = []
        //@seenTabToOpenCompletionList = false
        //@completer?.reset()
    }

    updateSelection() {
        for (let i = 0, len = this.suggestions.length; i < len; i++) {
            if (i === this.selection) {
                this.completionUl.find('li').eq(i).attr('class', 'vomnibarSelected');
            } else {
                this.completionUl.find('li').eq(i).attr('class', '');
            }
        }
    }

    generateItems(item, queryString) {
        return `<div class="vimiumReset vomnibarTopHalf">
            <span class="vimiumReset vomnibarSource #{insertTextClass}"></span><span class="vimiumReset vomnibarSource">title</span>
            <span class="vimiumReset vomnibarTitle">${this.highlightQueryTerms(item.title, queryString)}</span>
            </div>`
    }

    /**
     * 将匹配的关键词在笔记标题中高亮显示
     *
     */
    highlightQueryTerms(string, queryString) {
        let ranges = [];

        const terms = queryString.split(' ');

        for (const term of terms) {
            this.pushMatchingRanges(string, term, ranges);
        }

        ranges = this.mergeRanges(ranges.sort((a, b) => a[0] - b[0]));

        // replace portions of the string from right to left.
        ranges = ranges.sort((a, b) => b[0] - a[0]);
        for (const range of ranges) {
            const start = range[0];
            const end = range[1];
            string = string.substring(0, start) +
                `<span class='vomnibarMatch'>${string.substring(start, end)}</span>` +
                string.substring(end)
        }
        return string;
    }

    /**
     * 找到匹配关键词在整个字符串中的范围位置
     *
     */
    pushMatchingRanges(string,term,ranges) {
        let textPosition = 0;
        // 用下面的正则分组，可以把term包含在数组中，比如：
        // 'javascript'.split(/(a)/i)
        // (5) ["j", "a", "v", "a", "script"]
        // 最后一个元素可以不要，只遍历前面的
        const splits = string.split(getSearchStrRegex(term, '(', ')'));
        for (let i = 0, len = splits.length; i < len; i += 2) {
            if (i < splits.length -1) {
                const unmatchedText = splits[i];
                textPosition += unmatchedText.length;
                ranges.push([textPosition, textPosition + term.length]);
                textPosition += term.length;
            }

        }
        for (let indexStr in splits) {
        }
    }

    /**
     * merge 重叠的range
     * 比如：关键词分别出现在string的0-5,3-7，merge之后就变为0-7
     */
    mergeRanges(ranges) {
        // start from the first one, 第一个肯定是没问题的，在第一个基础上算区间
        // 重复
        let previous = ranges.shift();
        // push into final result
        const mergedRanges = [previous];
        ranges.forEach( (range) => {
            if (previous[1] >= range[0]) {
                previous[1] = Math.max(range[1], previous[1]);
            } else {
                mergedRanges.push(range);
            }
            previous = range;
        } )
        return mergedRanges;
    }

}

