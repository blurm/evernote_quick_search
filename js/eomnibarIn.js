/**
 * 负责iframe内搜索框本身的事件以及处理
 *
 */
class EomnibarIn {
    constructor() {
        this.eomnibarDOM = null;
        this.completionUl = null;
        this.input = null;

        this.suggestions = [];
        this.maxSuggestion = 15;
        this.selection = 0;
        this.forceNewTab = false;
        this.openInNewTab = false;

        // port for communication with background page - this is chrome way
        this.backgroundPort = chrome.runtime.connect({name: 'eomnibarPort'});
        this.backgroundPort.onMessage.addListener((msg) => {
            console.log(msg);
            this.displaySuggestions(msg.queryString, msg.suggestions);
        });

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('in.js onMessage addListener');
            if (request.action === 'eomnibar_activateInNewTab') {
                console.log('activateInNewTab in.js');
                this.forceNewTab = true;
            } else if (request.action === 'eomnibar_defaultSuggestions') {
                this._getDefaultSuggestions();
            }
        });

        // Deprecated
        // Port for conmmunication with iframe - this is html5 way
        //this.port = 'port';

        this.init();
    }

    init() {
        // Deprecated
        //onmessage = (e) => {
            //console.log(e.data);
            //e.ports[0].postMessage('Message: received by IFrame: "' + e.data + '"');
            //this.port = e.ports[0];
            //this.port.onmessage = (e) => {this.handleMessage(e)};
        //};

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

    // Deprecated
    handleMessage(e) {
        if (e.data === 'eomnibar_activateInNewTab') {
            this.forceNewTab = true;
            console.log('iframe got message: activeInNewTab');
        }
    }

    initEvent() {
        $(window).focus( () => {this.input.focus()} );
        this.input.on('input', (event) => {this.onInput(event)});
        this.input.blur((event) => {console.log('input blur');this.input.focus();});
        this.input.keydown( (event) => { this.onActionKeydown(event) } );
        this.input.keyup( (event) => { this.onActionKeyup(event) } );
        $(document).click(() => {this.hide()});
        $(this.eomnibarDOM).click( (event) => {event.stopPropagation()} );
    }

    onKeydown(event) {
        const queryString = event.currentTarget.value.trim();
        console.log(queryString);
    }

    onInput(event) {
        this.selection = 0;

        const queryString = event.currentTarget.value.trim();
        if (queryString === '') {
            this.completionUl.empty();
            return;
        }

        this.backgroundPort.postMessage({
            action: 'performSearch',
            queryString: queryString,
            maxSuggestion: this.maxSuggestion
        });
    }

    onActionKeyup(event) {
        const queryString = event.currentTarget.value.trim();
        const action = this._actionFromKeyupEvent(event);

        if (!action) {
            return true;
        }
        if (action === 'delete') {
            if (!queryString) {
                this._getDefaultSuggestions();
            }
        }
    }

    /**
     * Implement eomnibar's own key binding
     *
     */
    onActionKeydown(event) {

        const queryString = event.currentTarget.value.trim();
        console.log('onActionKeydown', queryString);

        const action = this._actionFromKeydownEvent(event);
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
                //chrome.tabs.create({url: curSuggestion.url});
                chrome.runtime.sendMessage({action: 'openInNewTab', url: curSuggestion.url});
            } else {
                //chrome.tabs.update({url: curSuggestion.url});
                chrome.runtime.sendMessage({action: 'openInCurrentTab', url: curSuggestion.url});
            }
        }
        event.stopImmediatePropagation()
        event.preventDefault()
    }

    displaySuggestions(queryString, suggestions) {
        this.completionUl.empty();

        // If matched suggestions
        if (suggestions.length === 0) {
            return;
        }

        this.suggestions = suggestions;

        this.completionUl.append(this._convertNote2HTML(queryString, suggestions));
        // Hightlight current selected
        this.updateSelection();
        this.completionUl.show();
    }

    _convertNote2HTML(queryString, suggestions) {
        let htmlItems = '';
        for (let i in suggestions) {
            const index = parseInt(i);
            htmlItems += this._generateSuggestion(suggestions[index], queryString.trim());

            // Only display maxed suggestions
            if (index === this.maxSuggestion) {
                break;
            }
        }

        return htmlItems;
    }


    _actionFromKeyupEvent(event) {
        const key = event.key;
        if(["Backspace", "Delete"].includes(key)) {
            return "delete"
        }
    }

    _actionFromKeydownEvent(event) {
        const key = event.key;
        if (key === 'Escape' || (event.ctrlKey && key === '[')) {
            return 'dismiss';
        } else if (key == 'ArrowUp' ||
            (event.shiftKey && key == "Tab") ||
            (event.ctrlKey && (key == "k" || key == "p"))) {
            return 'up';
        } else if (key == "Tab" && !event.shiftKey) {
            return 'down';
        } else if (key == "ArrowDown" ||
            (event.ctrlKey && (key == "j" || key == "n"))) {
            return 'down';
        } else if (key == "Enter") {
            return 'enter';
        }
    }

    hide() {
        //this.port.postMessage('hide');
        chrome.runtime.sendMessage({action: 'hide'});
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

    _generateSuggestion(suggestion, queryString) {
        console.log(suggestion);
        return `<li class="">
                    <div class="eomnibarTopHalf">
                        <span class="eomnibarSource"></span>
                        <span class="eomnibarTitle">
                            ${this._highlightQueryTerms(suggestion, queryString)}
                        </span>
                    </div>
                </li>`;
    }

    /**
     * 将匹配的关键词在笔记标题中高亮显示
     *
     */
    _highlightQueryTerms(suggestion, queryString) {
        let ranges = [];
        let string = suggestion.title;

        const terms = queryString.split(' ');

        for (const term of terms) {
            this._pushAllMatchingRanges(suggestion, term, ranges);
        }

        ranges = this._mergeRanges(ranges.sort((a, b) => a[0] - b[0]));

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
    _pushAllMatchingRanges(suggestion,term,ranges) {
        let textPosition = 0;
        // 用下面的正则分组，可以把term包含在数组中，比如：
        // 'javascript'.split(/(a)/i)
        // (5) ["j", "a", "v", "a", "script"]
        // 最后一个元素可以不要，只遍历前面的
        this._pushMatchingRanges(suggestion.title, textPosition, term, ranges);

        const regexCN = getCNContainedRegex();
        // 当前查询字符串为英文则进行首字母匹配
        if (!regexCN.test(term) && regexCN.test(suggestion.title)) {
            this._pushPinyinMatchingRanges(suggestion, term, ranges);
        }
    }

    /**
     * 找到关键词在大写拼音首字母中的位置范围
     *
     */
    _pushPinyinMatchingRanges(suggestion, term, ranges) {
        for (const pyField of suggestion.pinyinFields) {
            let string = pyField.firstLetters;
            let textPosition = pyField.range[0]
            this._pushMatchingRanges(string, textPosition, term, ranges);
        }
    }

    _pushMatchingRanges(string, textPosition, term, ranges) {
        const splits = string.split(getSearchStrRegex(term, '(', ')'));
        for (let i = 0, len = splits.length; i < len; i += 2) {
            // 忽略最后一个元素，计算过程中用不到
            if (i < splits.length -1) {
                const unmatchedText = splits[i];
                textPosition += unmatchedText.length;
                ranges.push([textPosition, textPosition + term.length]);
                textPosition += term.length;
            }

        }
    }

    /**
     * merge 重叠的range
     * 比如：关键词分别出现在string的0-5,3-7，merge之后就变为0-7
     */
    _mergeRanges(ranges) {
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

    _getDefaultSuggestions() {
        chrome.runtime.sendMessage(
            {action: 'performSearch', queryString:'', maxSuggestion: 15},
            (response) => {this.displaySuggestions('', response.suggestions)}
        );
    }
}

$(document).ready(function(){
    //var controller = chrome.extension.getBackgroundPage().eomnibarController;
    var barIn = new EomnibarIn();
});
