'use strict';

const test = require('tape');
const fs = require('fs');
const path = require('path');
const parser = require('../lib/qmlweb.parser');

const saveMode = !!process.env.QMLWEB_TESTS_SAVE_MODE;

function buildTree(dir, data) {
  data = data || {};
  const subdirs = [];
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      subdirs.push(filePath);
    } else {
      if (!data[dir]) {
        data[dir] = [];
      }
      data[dir].push(file);
    }
  }
  for (const subdir of subdirs) {
    buildTree(subdir, data);
  }
  return data;
}

const tree = buildTree('tests');
for (const dir in tree) {
  if (dir === 'tests') continue;
  if (dir.indexOf('failing') !== -1) continue;

  const files = tree[dir];

  test(dir.replace(/tests./, ''), function (t) {
    t.plan(files.filter(function(x) {
      return !/\.json$/.test(x)
    }).length);

    for (const file of files) {
      const extension = file.replace(/.*\./, '');
      let type;

      switch (extension) {
        case 'json':
          continue;
        case 'qml':
          type = parser.qmlweb_parse.QMLDocument;
          break;
        case 'js':
          type = parser.qmlweb_parse.JSResource;
          break;
        default:
          throw new Error('Unexpected file extension: ' + extension);
      }

      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, 'utf-8');
      let actual, expected;
      try {
        actual = parser.qmlweb_parse(source, type);
      } catch (e) {
        actual = { error: { name: e.name, message: e.message } };
      }

      // Normalize. NOTE: this translates undefined to null
      actual = JSON.parse(JSON.stringify(actual));

      if (saveMode && files.indexOf(file + '.json') === -1) {
        const json = JSON.stringify(actual, undefined, 2);
        fs.writeFileSync(filePath + '.json', json);
      }

      const content = fs.readFileSync(filePath + '.json', 'utf-8');
      expected = JSON.parse(content);

      t.deepEqual(actual, expected, file.replace(/.*[\\\/]/, ''));
    }
  });
}

