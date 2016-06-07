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
 * Exports:
 *
 * - qmlweb_parse(src, type) -- parses QML source and returns it as output
 *   tree expected by the QML engine
 */

// Object cloning for debug prints.
function clone(obj) {
  if (obj == null || typeof obj !== 'object')
    return obj;

  var temp = {}; // changed

  for (var key in obj)
    temp[key] = clone(obj[key]);
  return temp;
}

function QMLParseError(message, line, col, pos, source) {
  JS_Parse_Error.call(this, message, line, col, pos);
  var comment = extractLinesForErrorDiag(source, line);
  this.comment = comment ? comment : "";
  this.message += " (line: " + this.line + ", col: " + col + ", pos: " + pos + ")" + "\n" + comment + "\n";
  this.file = qmlweb_parse.nowParsingFile;
}
QMLParseError.prototype = new Error();

function extractLinesForErrorDiag(text, line) {
  var r = "";
  var lines = text.split("\n");

  for (var i = line - 3; i <= line + 3; i++) {
    if (i >= 0 && i < lines.length ) {
      var mark = i === line ? ">>" : "  ";
      r += mark + (i + 1) + "  " + lines[i] + "\n";
    }
  }

  return r;
}

function qmlweb_tokenizer($TEXT) {
  // Override UglifyJS methods

  parse_error = function(err) {
    throw new QMLParseError(err, S.tokline, S.tokcol, S.tokpos, S.text);
  };

  // WARNING: Here the original tokenizer() code gets embedded
  return tokenizer($TEXT);
}

function qmlweb_parse($TEXT, document_type, exigent_mode) {
  var embed_tokens = false; // embed_tokens option is not supported

  var TEXT = $TEXT.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, '');
  $TEXT = qmlweb_tokenizer($TEXT, true);

  // WARNING: Here the original parse() code gets embedded
  parse($TEXT,exigent_mode,false);
  // NOTE: Don't insert spaces between arguments!

  // Override UglifyJS methods

  croak = function(msg, line, col, pos) {
    var ctx = S.input.context();
    throw new QMLParseError(msg,
      line != null ? line : ctx.tokline,
      col != null ? col : ctx.tokcol,
      pos != null ? pos : ctx.tokpos,
      TEXT
    );
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
        return is_token(peek(), "name", "pragma") ? qml_pragma_statement() : unexpected();
      }
    }
    return statement_js();
  };

  array_ = function() {
    var from = S.token.pos;
    var stat = expr_list("]", !exigent_mode, true);
    var to = S.token.pos;
    return as("array", stat, "[" + TEXT.substr(from, to - from));
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

  function as_statement() {
    var res = slice(arguments);
    S.in_function++;
    var start = S.token.pos;
    res.push(statement());
    var end = S.token.pos;
    S.in_function--;
    res.push(TEXT.substr(start, end - start));
    return res;
  }

  function maybe_qmlelem(no_in) {
    var expr = maybe_assign(no_in);
    if (is("punc", "{"))
      return as("qmlelem", expr[1], undefined, qmlblock());
    return expr;
  }

  function qml_is_element(str) {
    return str[0].toUpperCase() == str[0];
  }

  function qmlblock() {
    expect("{");
    var a = [];
    while (!is("punc", "}")) {
      if (is("eof"))
        unexpected();
      a.push(qmlstatement());
    }
    expect("}");
    return a;
  }

  function qmlpropdef() {
    var type = S.token.value;
    next();
    var name = S.token.value;
    next();
    if (type == "alias") {
      expect(":");
      if (!is("name"))
        unexpected();
      var objName = S.token.value;
      next();
      if (is("punc", ".")) {
        next();
        if (!is("name"))
          unexpected();
        var propName = S.token.value;
        next();
      }
      return as("qmlaliasdef", name, objName, propName);
    }
    if (is("punc", ":")) {
      next();
      return as_statement("qmlpropdef", name, type);
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
        if (first)
          first = false;
        else
          expect(",");
        if (!is("name"))
          unexpected();
        var type = S.token.value;
        next();
        if (!is("name"))
          unexpected();
        args.push({ type: type, name: S.token.value });
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
      return as("qmlmethod", name, stat, TEXT.substr(from, to - from));
    } else if (is("name", "signal")) {
      next();
      if (is("punc", ":")) {
        next();
        return as_statement("qmlprop", "signal");
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
      } else if (is("punc", ".")) { // property statement
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
        return as_statement("qmlobjdef", propname, subname);
      } else if (is("punc", "{")) {
        return as("qmlobj", propname, qmlblock());
      } else {
        // Evaluatable item
        expect(":");
        return as_statement("qmlprop", propname);
      }
    } else if (is("keyword", "default")) {
      return qmldefaultprop();
    } else {
      todo();
    }
  }

  function qml_pragma_statement() {
    next();
    next();
    var pragma = S.token.value;
    next();
    return as("qmlpragma", pragma);
  }

  function qmlimport() {
    // todo
    next();
    var moduleName = S.token.value;
    var isDottedNotation = S.token.type == "name";
    next();

    while (is("punc", ".")) {
      next();
      moduleName += "." + S.token.value;
      next();
    }
    if (is("num")) {
      var version = S.token.value;
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
}

qmlweb_parse.nowParsingFile = ''; // TODO: make a parameter of qmlweb_parse
qmlweb_parse.QMLDocument = 1;
qmlweb_parse.JSResource = 2;

exports.qmlweb_parse = qmlweb_parse;
