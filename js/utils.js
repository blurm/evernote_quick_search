// Escape all special characters, so RegExp will parse the string 'as is'.
// Taken from http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegexSpecialCharacters(str) {
    escapeRegex = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g
    return str.replace(escapeRegex, "\\$&");
}

function hasUpperCase(str) {
    return str.toLowerCase() != str;
}

function getSearchStrRegex(string, prefix="", suffix="") {
    let regexpString = prefix + string;
    regexpString = regexpString + suffix;
    // Smartcase: Regexp is case insensitive, unless `string` contains a capital letter (testing `string`, not `regexpString`).
    const flag = hasUpperCase(string) ? '' : 'i';
    return new RegExp(regexpString, flag);
}
