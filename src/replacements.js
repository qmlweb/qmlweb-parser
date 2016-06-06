const uglify = require('uglify-js/lib/parse-js');

function source(fn) {
  return Function.prototype.toString.call(fn)
    .replace(/\n/g, '%NL%')
    .replace(/\r/g, '')
    .replace(/[^{]*{/, '')
    .replace(/}[^}]*$/, '')
    .replace(/%NL%/g, '\n');
}

const tokenizer = source(uglify.tokenizer);
const parse = source(uglify.parse).split('return as("toplevel"')[0];

module.exports = [
  { from: 'return tokenizer($TEXT);', to: tokenizer },
  { from: 'parse($TEXT,exigent_mode,false);', to: parse }
];
