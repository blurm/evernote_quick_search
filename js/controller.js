class Controller {
    constructor() {
        this.isSandbox = eomnibarConfig.isSandbox;

        // Set api key and host by user's language setting in Chrome
        chrome.i18n.getAcceptLanguages((list) => {
            if ('zh-CN' === list[0]) {
                this.developerToken = eomnibarConfig.yinxiang.developerToken;
                this.consumerKey = eomnibarConfig.yinxiang.consumerKey;
                this.consumerSecret = eomnibarConfig.yinxiang.consumerSecret;
                this.evernoteHostName = this.isSandbox ? 'https://sandbox.evernote.com' : eomnibarConfig.yinxiang.hostName;
            } else {
                this.developerToken = eomnibarConfig.evernote.developerToken;
                this.consumerKey = eomnibarConfig.evernote.consumerKey;
                this.consumerSecret = eomnibarConfig.evernote.consumerSecret;
                this.evernoteHostName = this.isSandbox ? 'https://sandbox.evernote.com' : eomnibarConfig.evernote.hostName;
            }

            const options = {
                consumerKey: this.consumerKey,
                consumerSecret: this.consumerSecret,
                callbackUrl : "gotOAuth.html",
                signatureMethod : "HMAC-SHA1"
            };
            this.oauth = OAuth(options);

            this.initOAuthInfo();
        });
    }

    initOAuthInfo() {
        chrome.storage.sync.get((items) => {
            console.log('storage.sync:', items);

            // 如果token为空则跳转到授权页面
            if (!items.oauth_token) {
                chrome.tabs.create({url:"main.html"});
                return;
            }

            this.expires = items.edam_expires;
            this.noteStoreUrl = items.edam_noteStoreUrl;
            this.shard = items.edam_shard;
            this.userId = items.edam_userId;
            this.webApiUrlPrefix = items.edam_webApiUrlPrefix;
            this.oauth_token = items.oauth_token;
            this.oauth_token_secret = items.oauth_token_secret;

            const spec = new NotesMetadataResultSpec();
            spec.includeTitle = true;
            spec.includeUpdated = true;

            const searchOptions = {
                noteStoreUrl: this.noteStoreUrl,
                //authToken: this.oauth_token,
                authToken: this.developerToken ? this.developerToken : this.oauth_token,
                filter: new NoteFilter(),
                partNoteURL: this.evernoteHostName + '/shard/' + this.shard +
                '/nl/' + this.userId
            };
            this.search = new Search(searchOptions);
        });

        //chrome.storage.local.get((items) => {
            //console.log('storage.local:', items);

        //});
    }

    loadAllNotes() {
        this.allNotes = [];
        this.search.notesCount = 0;
        this.search.loadAllNotes(this.allNotes, () => {this.genPinyinTitleField();});
        console.log('all notes length:', this.allNotes.length);
    }

    genPinyinTitleField() {
        for (const note of this.allNotes) {
            const regexCN = getCNContainedRegex();
            const pinyinFields = [];
            note.pinyinFields = pinyinFields;

            // 不包含中文则跳过
            if (!regexCN.test(note.title)) {
                note.containCN = false;
                continue;
            }
            note.containCN = true;

            const splits = note.title.split(regexCN);
            let start = 0;
            for (let i = 1, len = splits.length; i < len; i += 2) {
                const pyField = {};
                pyField.firstLetters = pinyinUtil.getFirstLetter(splits[i], false);

                start += splits[i-1].length;
                const end = start + splits[i].length;
                pyField.range = [start, end];
                pinyinFields.push(pyField);

                start = end;
            }
        }
    }

    logout() {
        console.log('logout');
        chrome.storage.local.clear(() => {
            this.expires = null;
            this.noteStoreUrl = null;
            this.shard = null;
            this.userId = null;
            this.webApiUrlPrefix = null;
            this.oauth_token = null;
            this.oauth_token_secret = null;

            var error = chrome.runtime.lastError;
            if (error) {
                console.error(error);
            }
        });
    }

    loginWithEvernote() {
        this.oauth.request({'method': 'GET', 'url': this.evernoteHostName +
            '/oauth', 'success': (data) => {this.success(data)}, 'failure': (error) => {this.failure(error);}});
    }

    failure(error) {
        console.log(error);
    }

    success(data) {
        const that = this;
        var isCallBackConfirmed = false;
        var tempToken = '';
        var vars = data.text.split("&");
        for (var i = 0; i < vars.length; i++) {
            var y = vars[i].split('=');
            if(y[0] === 'oauth_token')  {
                tempToken = y[1];
            }
            else if(y[0] === 'oauth_token_secret') {
                console.log(vars);
                this.oauth_token_secret = y[1];
                chrome.storage.sync.set({oauth_token_secret: y[1]})
                console.log('set access token', y[1]);
            }
            else if(y[0] === 'oauth_callback_confirmed') {
                isCallBackConfirmed = true;
            }
        }

        // 回调地址是否已经设置
        if(isCallBackConfirmed) {
            // step 2
            const url = this.evernoteHostName + '/OAuth.action?oauth_token=' + tempToken;
            // 打开用户授权窗口
            chrome.tabs.create({ url: url }, (tab) => {
                console.log(tab.id);
                console.log(tab.url);
            });

            //var filter = {
                //url:
                //[
                    //{hostContains: "evernote.com"},
                    //{hostPrefix: "sandbox"}
                //]
            //}
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                chrome.tabs.query({active: true}, (tab) => {
                    if (changeInfo.status === 'loading') {
                        console.log('tabs.onUpdated -- tab: ' + tabId +
                            ' status ' + changeInfo.status + ' url ' + changeInfo.url);

                        var loc = changeInfo.url;
                        //if (loc && loc.indexOf(this.evernoteHostName + '/Home.action?gotOAuth.html?') >= 0) {
                        if (loc && loc.indexOf('gotOAuth.html?') >= 0) {
                            console.log(loc);
                            var index, verifier = '';
                            var got_oauth = '';
                            var params = loc.substr(loc.indexOf('?') + 1);
                            params = params.split('&');
                            for (var i = 0; i < params.length; i++) {
                                var y = params[i].split('=');
                                if(y[0] === 'oauth_verifier') {
                                    verifier = y[1];
                                }
                                //else if(y[0] === 'gotOAuth.html?oauth_token') {
                                else if(y[0] === 'oauth_token') {
                                    got_oauth = y[1];
                                }
                            }

                            // step 3
                            let local_token = '';
                            chrome.storage.sync.get((items) => {
                                this.oauth.setVerifier(verifier);
                                this.oauth.setAccessToken([got_oauth, items.oauth_token_secret]);

                                var getData = {'oauth_verifier':verifier};
                                chrome.tabs.remove(tabId, function() {
                                    console.log('tab: ' + tabId + ' removed.');
                                });
                                this.oauth.request({'method': 'GET', 'url': this.evernoteHostName + '/oauth',
                                    'success': (data) => {this.success(data);}, 'failure': (error) => {this.failure(error);}});
                            });

                        }
                    }
                });
            });
        } else {
            var querystring = this.getQueryParams(data.text);
            chrome.storage.sync.set({edam_expires: querystring.edam_expires});
            chrome.storage.sync.set({edam_noteStoreUrl: querystring.edam_noteStoreUrl});
            chrome.storage.sync.set({edam_shard: querystring.edam_shard});
            chrome.storage.sync.set({edam_userId: querystring.edam_userId});
            chrome.storage.sync.set({edam_webApiUrlPrefix: querystring.edam_webApiUrlPrefix});
            chrome.storage.sync.set({oauth_token: querystring.oauth_token});
            chrome.storage.sync.set({oauth_token_secret: querystring.oauth_token_secret});

            this.initOAuthInfo();
        }

    }

    getQueryParams(queryParams) {
        var i, query_array,
            query_array_length, key_value, decode = OAuth.urlDecode,querystring = {};
        // split string on '&'
        query_array = queryParams.split('&');
        // iterate over each of the array items
        for (i = 0, query_array_length = query_array.length; i < query_array_length; i++) {
            // split on '=' to get key, value
            key_value = query_array[i].split('=');
            if (key_value[0] != "") {
                querystring[key_value[0]] = decode(key_value[1]);
            }
        }
        return querystring;
    }

    performSearch(queryString, maxSuggestion) {
        console.log(queryString);
        if (!queryString) {
            console.log('empty queryString, returned');
            return;
        }
        const queryTerms = queryString.split(' ');
        const suggestions = [];
        for (let i = 0, len = this.allNotes.length; i < len; i++) {
            const curNote = this.allNotes[i];
            // 全部的queryTerm都匹配，才能算该suggestion匹配
            let matched = true;
            for (const queryTerm of queryTerms) {
                const regex = getSearchStrRegex(queryTerm);
                if (!this._isMatchSuggestion(curNote, queryTerm)) {
                    matched = false;
                }
            }
            if (matched && suggestions.length < maxSuggestion) {
                suggestions.push(curNote);
            }
        }

        return suggestions;
    }

    _isMatchSuggestion(curNote, queryTerm) {
        const regex = getSearchStrRegex(queryTerm);
        if (regex.test(curNote.title) || this._isMatchPinyin(curNote, queryTerm)) {
            return true;
        }
        return false;
    }

    _isMatchPinyin(curNote, queryTerm) {
        const regex = getSearchStrRegex(queryTerm);
        for (const pyField of curNote.pinyinFields) {
            if (regex.test(pyField.firstLetters)) {
                return true;
            }
        }
        return false;
    }
}
