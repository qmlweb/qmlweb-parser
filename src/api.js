/* @license

  Copyright (c) 2010 Mihai Bazon <mihai.bazon@gmail.com>
  Copyright (c) 2011 Lauri Paimen <lauri@paimen.info>
  Copyright (c) 2013 Anton Kreuzkamp <akreuzkamp@web.de>
  Copyright (c) 2016 qmlweb-parser contributors
  Based on parse-js (http://marijn.haverbeke.nl/parse-js/).

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions
  are met:

      * Redistributions of source code must retain the above
        copyright notice, this list of conditions and the following
        disclaimer.

      * Redistributions in binary form must reproduce the above
        copyright notice, this list of conditions and the following
        disclaimer in the documentation and/or other materials
        provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
  OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
  TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
  THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
  SUCH DAMAGE.
*/


/*
 * QML parser and parsetree'er.
 *
 * Based on Javascript parser written by Mihai Bazon for UglifyJS project.
 * That, again, is a port of Javascript parser by Marijn Haverbeke.
 * Big thanks to both of you (and others involved)!
 * UglifyJS: https://github.com/mishoo/UglifyJS
 * Marijn's parser: http://marijn.haverbeke.nl/parse-js/
 *
 * The primary goal of this file is to offer QML parsing *on top of UglifyJS
 * parser* and to change Javascript parts as little as possible. If you find
 * bugs/improvements to Javascript parsing parts, check if those are fixed to
 * UglifyJS parser first. If not, fix them there. After UglifyJS has been fixed,
 * backport the changes to this file. Less changes to Javascript, more easy it
 * will be to keep up with UglifyJS.
 * Ultimately it would be great to keep the original parser and QML additions in
 * different files but the structure of code does not support that.
 *
 * Exports:
 *
 * - parseQML(src) -- parses QML source and returns it as output tree expected
 *   by the QML engine
 */

// Object cloning for debug prints.
function clone(obj){
    if(obj == null || typeof(obj) != 'object')
        return obj;

    var temp = {}; // changed

    for(var key in obj)
        temp[key] = clone(obj[key]);
    return temp;
}

function QMLParseError(message, line, col, pos, comment) {
        JS_Parse_Error.call(this, message, line, col, pos);
        this.line++;
        this.comment = comment ? comment : "";
        this.message += " (line: " + this.line + ", col: " + col + ", pos: " + pos + ")" + "\n" + comment + "\n";
        this.file = qmlweb_parse.nowParsingFile;
};
QMLParseError.prototype = new Error();

function qml_parse_error(message, line, col, pos, comment) {
        throw new QMLParseError(message, line, col, pos, comment);
};

function extractLinesForErrorDiag(text, line)
{
  var r = "";
  var lines = text.split("\n");

  for (var i = line - 3; i <= line + 3; i++)
  if (i >= 0 && i < lines.length ) {
      var mark = ( i == line ) ? ">>" : "  ";
      r += mark + (i + 1) + "  " + lines[i] + "\n";
  }

  return r;
}

function tokenizer_($TEXT) {
        // Override UglifyJS methods

        parse_error = function(err) {
                qml_parse_error(err, S.tokline, S.tokcol, S.tokpos, extractLinesForErrorDiag( S.text, S.tokline ) );
        };

        // WARNING: Here the original tokenizer() code gets embedded
        // return tokenizer($TEXT);
}

function qmlweb_parse_($TEXT, document_type, exigent_mode, embed_tokens) {

        // WARNING: Here the original parse() code gets embedded
        // parse($TEXT, exigent_mode, embed_tokens);

        if (embed_tokens) {
          throw new Error('embed_tokens option is not supported by qmlweb_parse');
        }

        S.text = $TEXT.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, '');

        // Override UglifyJS methods

        croak = function(msg, line, col, pos) {
                var ctx = S.input.context();
                var eLine = (line != null ? line : ctx.tokline);
                qml_parse_error(msg,
                         eLine,
                         col != null ? col : ctx.tokcol,
                         pos != null ? pos : ctx.tokpos,
                         extractLinesForErrorDiag( S.text, eLine ) );
        };

        expect_token = function(type, val) {
                if (is(type, val)) {
                        return next();
                }
                token_error(S.token, "Unexpected token " + S.token.type + " " + S.token.val + ", expected " + type + " " + val);
        };

        var statement_js = statement;
        statement = function() {
                switch (S.token.type) {
                    case "punc":
                        switch (S.token.value) {
                            case ".":
                                return is_token(peek(), "name", "pragma")
                                    ? qml_pragma_statement() : unexpected();
                        }
                }
                return statement_js();
        }

        function qml_pragma_statement() {
                next();
                next();
                var pragma = S.token.value;
                next();
                return as("qmlpragma", pragma);
        };

        array_ = function () {
                var from = S.token.pos,
                    stat = expr_list("]", !exigent_mode, true),
                    to = S.token.pos;
                return as("array", stat, "[" + S.text.substr(from, to - from));
        };

        function maybe_qmlelem(no_in) {
                var expr = maybe_assign(no_in);
                if (is("punc", "{"))
                    return as("qmlelem", expr[1], undefined, qmlblock());
                return expr;
        };

        expression = function(commas, no_in) {
                if (arguments.length == 0)
                        commas = true;
                var expr = maybe_qmlelem(no_in);
                if (commas && is("punc", ",")) {
                        next();
                        return as("seq", expr, expression(true, no_in));
                }
                return expr;
        };

        // QML-specific methods

        function qml_is_element(str) {
            return str[0].toUpperCase() == str[0];
        }

        function qmlblock() {
            expect("{");
            var a = [];
            while (!is("punc", "}")) {
                if (is("eof")) unexpected();
                a.push(qmlstatement());
            }
            expect("}");
            return a;
        }

        function qmlproperty() {
            switch (S.token.type) {
                case "name":
                    return as("qmlbinding", statement());
                case "num":
                case "string":
                    return as("qmlvalue", prog1(S.token.value, next,
                        semicolon));
                default:
                    todo();
            }
        }

        function qmlpropdef() {
            var type = S.token.value;
            next();
            var name = S.token.value;
            next();
            if (type == "alias") {
                expect(":");
                if (!is("name")) unexpected();
                var objName = S.token.value;
                next();
                if (is("punc", ".")) {
                    next();
                    if (!is("name")) unexpected();
                    var propName = S.token.value;
                    next();
                }
                return as("qmlaliasdef", name, objName, propName);
            }
            if (is("punc", ":")) {
                next();
                S.in_function++;
                var from = S.token.pos,
                    stat = statement(),
                    to = S.token.pos;
                S.in_function--;
                return as("qmlpropdef", name, type, stat,
                        S.text.substr(from, to - from));
            } else if (is("punc", ";"))
                next();
            return as("qmlpropdef", name, type);

        }

        function qmldefaultprop() {
            next();
            expect_token("name", "property");

            return as("qmldefaultprop", qmlpropdef());
        }

        function qmlsignaldef() {
            var name = S.token.value;
            next();
            var args = [];
            if (is("punc", "(")) {
                next();
                var first = true;
                while (!is("punc", ")")) {
                        if (first) first = false; else expect(",");
                        if (!is("name")) unexpected();
                        var type = S.token.value;
                        next();
                        if (!is("name")) unexpected();
                        args.push({type: type, name: S.token.value});
                        next();
                }
                next();
            }
            if (is("punc", ";"))
                next();
            return as("qmlsignaldef", name, args);

        }

        function qmlstatement() {
            if (is("keyword", "function")) {
                var from = S.token.pos;
                next();
                var stat = function_(true);
                var to = S.token.pos;
                var name = stat[1];
                return as("qmlmethod", name, stat,
                    S.text.substr(from, to - from));
            } else if (is("name", "signal")) {
                next();
                if (is("punc", ":")) {
                    next();
                    S.in_function++;
                    var from = S.token.pos,
                        stat = statement(),
                        to = S.token.pos;
                    S.in_function--;
                    return as("qmlprop", propname, stat,
                        S.text.substr(from, to - from));
                } else {
                    return qmlsignaldef();
                }
            } else if (S.token.type == "name") {
                var propname = S.token.value;
                next();
                if (propname == "property" && (S.token.type == "name" || S.token.value == "var")) {
                    return qmlpropdef();
                } else if (qml_is_element(propname) && !is("punc", ".")) {
                    // Element
                    var onProp;
                    if (is("name", "on")) {
                        next();
                        onProp = S.token.value;
                        next();
                    }
                    return as("qmlelem", propname, onProp, qmlblock());
                } else {
                    // property statement
                    if (is("punc", ".")) {
                        // anchors, fonts etc, a.b: statement;
                        // Can also be Component.onCompleted: ...
                        // Assume only one subproperty
                        next();
                        var subname = S.token.value;
                        next();
                        /* Check for ModuleQualifier.QMLElement */
                        if (qml_is_element(subname)) {
                            return as("qmlelem", propname + "." + subname, undefined, qmlblock());
                        }
                        expect(":");
                        S.in_function++;
                        var from = S.token.pos,
                            stat = statement(),
                            to = S.token.pos;
                        S.in_function--;
                        return as("qmlobjdef", propname, subname, stat,
                            S.text.substr(from, to - from));
                    } else if (is("punc", "{")) {
                        return as("qmlobj", propname, qmlblock());
                    } else {
                        // Evaluatable item
                        expect(":");
                        S.in_function++;
                        var from = S.token.pos,
                            stat = statement(),
                            to = S.token.pos;
                        S.in_function--;
                        return as("qmlprop", propname, stat,
                            S.text.substr(from, to - from));
                    }
                }
            } else if (is("keyword", "default")) {
                return qmldefaultprop();
            } else {
                todo();
            }
        }

        function qmlimport() {
            // todo
            next();
            var moduleName = S.token.value;
            var isDottedNotation = (S.token.type == "name");
            next();
            
            while (is("punc", ".")) {
                next();
                moduleName += "." + S.token.value;
                next();
            }
            if (is("num")) {
                var version = S.token.value
                next();
            }
            var namespace = "";
            if (is("name", "as")) {
                next();
                namespace = S.token.value;
                next();
            }
            return as("qmlimport", moduleName, version, namespace, isDottedNotation);
        }

        function qmldocument() {
            var imports = [];
            while (is("name", "import")) {
                imports.push(qmlimport());
            }
            var root = qmlstatement();
            if (!is("eof"))
                unexpected();

            return as("toplevel", imports, root);
        }

        function jsdocument() {
            var statements = [];
            while (!is("eof")) {
                statements.push(statement());
            }
            return as("jsresource", statements);
        }

        function amIn(s) {
            console && console.log(s, clone(S), S.token.type, S.token.value);
        }
        function todo() {
            amIn("todo parse:");
            next();
        }

        if (document_type === qmlweb_parse.JSResource) {
            return jsdocument();
        } else {
            return qmldocument();
        }
};

// Overriding functions
// All current variables should be exported here!

function source(fn) {
  return Function.prototype.toString.call(fn)
    .replace(/\n/g, '%NL%')
    .replace(/\r/g, '')
    .replace(/[^{]*{/, '')
    .replace(/}[^}]*$/, '')
    .replace(/%NL%/g, '\n');
}

var tokenizer_impl = source(tokenizer_) + source(tokenizer);

var qmlweb_parse_impl = source(parse).split('return as("toplevel"')[0] + source(qmlweb_parse_);

// WARNING: Evil!
// eval() is being used here to bind to current scope

tokenizer = eval(
  '(function($TEXT) {\n' +
  tokenizer_impl +
  '\n})'
);

qmlweb_parse = eval(
  '(function($TEXT, document_type, exigent_mode) {\n' +
  '  var embed_tokens = false;\n' +
  qmlweb_parse_impl +
  '\n})'
);

qmlweb_parse.nowParsingFile = ''; // TODO: make a parameter of qmlweb_parse
qmlweb_parse.QMLDocument = 1;
qmlweb_parse.JSResource = 2;

exports.qmlweb_parse = qmlweb_parse;
