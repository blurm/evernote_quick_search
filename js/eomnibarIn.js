class EomnibarIn {
    constructor(controller) {
        this.controller = controller;

        this.eomnibarDOM = null;
        this.completionUl = null;
        this.input = null;

        this.suggestions = [];
        this.maxSuggestion = 25;
        this.selection = 0;
        this.forceNewTab = false;
        this.openInNewTab = false;

        this.port = null;

        this.init();
    }

    init() {
        onmessage = (e) => {
            console.log(e.data);
            e.ports[0].postMessage('Message: received by IFrame: "' + e.data + '"');
            this.port = e.ports[0];
            this.port.onmessage = (e) => {this.handleMessage(e)};
        };

        $(document).ready( () => {
            console.log('EomnibarIn iframe loaded');
            const $eomnibar = $('#eomnibar');

            this.eomnibarDOM = $eomnibar;
            this.completionUl = this.eomnibarDOM.find('ul');
            this.input = this.eomnibarDOM.find('input');

            //this.hide();
            this.initEvent();
        });
    }

    handleMessage(e) {
        if (e.data === 'eomnibar_activateInNewTab') {
            this.forceNewTab = true;
            console.log('iframe got message: activeInNewTab');
        }
    }

    initEvent() {
        $(window).focus( () => {this.input.focus()} );
        this.input.on('input', (event) => {this.onInput(event)});
        this.input.blur((event) => {console.log('input blur');this.input.focus();})
        this.input.keydown( (event) => { this.onActionKeydown(event) } )
        $(document).click(() => {this.hide()});
        $(this.eomnibarDOM).click( (event) => {event.stopPropagation()} );
    }

    onInput(event) {
        this.completionUl.empty();

        // 所有匹配的选项
        const queryString = event.currentTarget.value.trim();
        if (queryString === '') {
            this.completionUl.hide();
            return;
        }
        const suggestions = this.controller.performSearch(queryString);
        this.suggestions = suggestions;
        this.selection = 0;

        // convert note items to html li
        let htmlItems = '';
        for (let i in suggestions) {
            const index = parseInt(i);
            if (index === this.selection) {
                htmlItems += '<li class="eomnibarSuggestion eomnibarSelected">' + this.generateItems(suggestions[index], queryString.trim()) + '</li>';
            } else {
                htmlItems += '<li class="eomnibarSuggestion">' + this.generateItems(suggestions[index], queryString.trim()) + '</li>';
            }

            if (index === 15) {
                break;
            }
        }

        if (suggestions.length === 0) {
            this.completionUl.hide();
        } else {
            this.completionUl.append(htmlItems);
            this.completionUl.show();
        }
    }

    onActionKeydown(event) {
        const action = this.actionFromKeyEvent(event);
        if (!action) {
            return true;
        }
        console.log('action keydown', action);

        // 是否在新窗口打开笔记
        this.openInNewTab = event.ctrlKey || event.shiftKey || this.forceNewTab;

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
            console.log('dismiss');
            this.hide();
        } else if (action === 'enter') {
            const curSuggestion = this.suggestions[this.selection];
            this.hide();
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
        this.port.postMessage('hide');
        this.reset();
    }

    reset() {
        this.input.val('');
        this.completionUl.empty();
        this.completionUl.hide();
        // 需要将焦点从iframe移出，否则任然会触发onInput
        //this.iframe.blur();
    }

    updateSelection() {
        for (let i = 0, len = this.suggestions.length; i < len; i++) {
            if (i === this.selection) {
                this.completionUl.find('li').eq(i).attr('class', 'eomnibarSelected');
            } else {
                this.completionUl.find('li').eq(i).attr('class', '');
            }
        }
    }

    generateItems(item, queryString) {
        return `<div class="evernote_qsReset eomnibarTopHalf">
            <span class="evernote_qsReset eomnibarSource #{insertTextClass}"></span><span class="evernote_qsReset eomnibarSource">title</span>
            <span class="evernote_qsReset eomnibarTitle">${this.highlightQueryTerms(item.title, queryString)}</span>
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
                `<span class='eomnibarMatch'>${string.substring(start, end)}</span>` +
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

//const shadow = $('#myroot')[0].shadowRoot;
//const $iframe = $(shadow).find('.eomnibarFrame');
//const $iframeContent = $($iframe[0].contentDocument);
//const $eomnibar = $iframeContent.find('#eomnibar');

$(document).ready(function(){
    console.log('iframe.js', $('#eomnibarInput'));
    var controller = new Controller();
    var barIn = new EomnibarIn(controller);
});