class Search {
    constructor(options) {
        this.noteStore = options.noteStore;
        this.authToken = options.authToken;
        this.filter = options.filter;
        this.spec = new NotesMetadataResultSpec();
        this.spec.includeTitle = true;
        this.spec.includeUpdated = true;


        const noteStoreURL = options.noteStoreUrl;
        const noteStoreTransport = new Thrift.BinaryHttpTransport(noteStoreURL);
        const noteStoreProtocol = new Thrift.BinaryProtocol(noteStoreTransport);
        this.noteStore = new NoteStoreClient(noteStoreProtocol);

        this.partNoteURL = options.partNoteURL;
        this.allNotes = [];
        this.notesCount = 0;

        //this.noteStore.listNotebooks(this.authToken, function (notebooks) {
            //console.log(notebooks);
        //}, (error) => { console.log(error);});
    }

    /**
     * fetch all notes' metadata from evernote
     *
     */
    loadAllNotes(allNotes) {
        this.noteStore.findNotesMetadata(this.authToken, this.filter, this.notesCount, 200, this.spec, (data) => {
            console.log(data);
            for (const note of data.notes) {
                //noteStore.getNote(authToken, note.guid, true, true, true,
                //true, (data) => { console.log(data); });

                //https://[service]/shard/[shardId]/nl/[userId]/[noteGuid]/
                const url = this.partNoteURL + '/' + note.guid;

                allNotes.push({
                    title: note.title,
                    guid: note.guid,
                    updated: note.updated,
                    url: url
                })
            }
            this.notesCount += data.notes.length;
            if (this.notesCount < data.totalNotes) {
                // 写成递归调用，当前笔记数小于总数时继续递归
                this.loadAllNotes(allNotes);
            } else {
                // put all notes into storage
                //chrome.storage.local.set({allNotes: this.allNotes});
                //console.log(this.allNotes);
                //return this.allNotes;
            }
        });
    }

}
