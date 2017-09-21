class Controller {
    constructor() {
        this.isSandbox = 0;
        this.reset = 1;

        this.consumerKey = 'blurm';
        this.consumerSecret = '3c51cc37dc7c6ef5';
        //Consumer Key: blurm-9322
        //Consumer Secret: e07995a2b96d7819
        this.evernoteHostName = this.isSandbox ? 'https://sandbox.evernote.com' : 'https://app.yinxiang.com';

        const options = {
            consumerKey: this.consumerKey,
            consumerSecret: this.consumerSecret,
            callbackUrl : "gotOAuth.html",
            signatureMethod : "HMAC-SHA1"
        };
        this.oauth = OAuth(options);

        this.initOAuthInfo();
    }

    initOAuthInfo() {
        chrome.storage.local.get((items) => {
            this.oauth_token_secret = items.oauth_token_secret;
            this.oauth_token = items.oauth_token;
            this.expires = items.edam_expires;
            this.noteStoreUrl = items.edam_noteStoreUrl;
            this.shard = items.edam_shard;
            this.userId = items.edam_userId;
            this.webApiUrlPrefix = items.edam_webApiUrlPrefix;
            this.oauth_token = items.oauth_token;
            this.oauth_token_secret = items.oauth_token_secret;

            console.log(items);


            const spec = new NotesMetadataResultSpec();
            spec.includeTitle = true;
            spec.includeUpdated = true;

            const searchOptions = {
                noteStoreUrl: this.noteStoreUrl,
                authToken: this.oauth_token,
                filter: new NoteFilter(),
                partNoteURL: this.evernoteHostName + '/shard/' + this.shard +
                '/nl/' + this.userId
            };
            this.search = new Search(searchOptions);
            this.allNotes = [];
            this.search.loadAllNotes(this.allNotes);
        });
    }

    logout() {
        console.log('logout');
        chrome.storage.local.clear(function() {
            var error = chrome.runtime.lastError;
            if (error) {
                console.error(error);
            }
        });
    }

    loginWithEvernote() {
        if (this.oauth_token && !this.reset) {
            console.log('already auth');

            setTimeout(() => {
                //chrome.storage.local.get((items) => {
                    let htmlItems = '';
                    const selection = 0;
                    for (let i in this.allNotes) {
                        const index = parseInt(i);
                        if (index === selection) {
                            htmlItems += '<li class="eomnibarSelected">' + generateItems(this.allNotes[index]) + '</li>';
                        } else {
                            htmlItems += '<li>' + generateItems(this.allNotes[index]) + '</li>';
                        }
                    }
                    const shadow = $('#myroot')[0].shadowRoot;
                    const $iframe = $(shadow).find('.eomnibarFrame');
                    const $iframeContent = $($iframe[0].contentDocument);
                    const $box = $iframeContent.find('#eomnibar');
                    const $completionList = $box.find('ul');
                    $completionList.append(htmlItems);
                //});
            }, 500);
        } else {
            // step 1
            this.oauth.request({'method': 'GET', 'url': this.evernoteHostName + '/oauth', 'success': (data) => {this.success(data)}, 'failure': (error) => {this.failure(error);}});
        }
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
                chrome.storage.local.set({oauth_token_secret: y[1]})
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
                            chrome.storage.local.get((items) => {
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
            chrome.storage.local.get('name', (items) => {
                console.log('storage get', items);
            });

            var querystring = this.getQueryParams(data.text);
            chrome.storage.local.set({edam_expires: querystring.edam_expires});
            chrome.storage.local.set({edam_noteStoreUrl: querystring.edam_noteStoreUrl});
            chrome.storage.local.set({edam_shard: querystring.edam_shard});
            chrome.storage.local.set({edam_userId: querystring.edam_userId});
            chrome.storage.local.set({edam_webApiUrlPrefix: querystring.edam_webApiUrlPrefix});
            chrome.storage.local.set({oauth_token: querystring.oauth_token});
            chrome.storage.local.set({oauth_token_secret: querystring.oauth_token_secret});

            this.initOAuthInfo();

            //var querystring = this.getQueryParams(data.text);
            //var noteStoreURL = querystring.edam_noteStoreUrl;
            //var noteStoreTransport = new Thrift.BinaryHttpTransport(noteStoreURL);
            //var noteStoreProtocol = new Thrift.BinaryProtocol(noteStoreTransport);
            //var noteStore = new NoteStoreClient(noteStoreProtocol);
            //var authTokenEvernote = querystring.oauth_token;
            //noteStore.listNotebooks(authTokenEvernote, function (notebooks) {
                //console.log(notebooks);
            //},
                //function onerror(error) {
                    //console.log(error);
                //});
            //var note = new Note;
            //note.content = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE en-note SYSTEM \"http://xml.evernote.com/pub/enml2.dtd\"><en-note><span style=\"font-weight:bold;\">Hello photo note.</span><br /><span>Evernote logo :</span><br /></en-note>";
            //note.title = "Hello javascript lib";
            //noteStore.createNote(authTokenEvernote,note,function (noteCallback) {
                //console.log(noteCallback.guid + " created");
            //});
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

    performSearch(queryString) {
        console.log(queryString);
        const queryTerms = queryString.split(' ');
        const suggestions = [];
        for (let i = 0, len = this.allNotes.length; i < len; i++) {
            const curNote = this.allNotes[i];
            let matched = true;
            for (const queryTerm of queryTerms) {
                const regex = getSearchStrRegex(queryTerm);
                if (!curNote.title.match(regex)) {
                    matched = false;
                }
            }
            if (matched) {
                suggestions.push(curNote);
            }
        }

        return suggestions;
    }
}
