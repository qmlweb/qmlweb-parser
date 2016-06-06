const gulp = require('gulp');
const concat = require('gulp-concat');
const replace = require('gulp-replace');
const changed = require('gulp-changed');
const order = require('gulp-order');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const iife = require('gulp-iife');
const istanbul = require('gulp-istanbul');
const tape = require('gulp-tape');
const tapSpec = require('tap-spec');

const replacements = require('./src/replacements');

const sources = [
  'src/header.js',
  'node_modules/uglify-js/lib/parse-js.js',
  'src/api.js',
];

gulp.task('test', ['build'], function() {
  return gulp.src('tests/tape.js')
    .pipe(tape({
      reporter: tapSpec()
    }));
});

gulp.task('cover', ['build-covered'], function() {
  return gulp.src('tests/tape.js')
    .pipe(tape({
      reporter: tapSpec()
    }))
    .pipe(istanbul.writeReports());
});

gulp.task('build-covered-api', function() {
  return gulp.src(['src/api.js'])
    .pipe(istanbul())
    .pipe(concat('api.covered.js'))
    .pipe(changed('./tmp'))
    .pipe(gulp.dest('./tmp'));
});

gulp.task('build-covered', ['build-covered-api'], function() {
  process.env.QMLWEB_PARSER_PATH = 'tmp/qmlweb.parser.covered';
  return gulp.src([
      'src/header.js',
      'node_modules/uglify-js/lib/parse-js.js',
      'tmp/api.covered.js',
    ])
    .pipe(order(sources, { base: __dirname }))
    .pipe(replace(replacements[0].from, replacements[0].to))
    .pipe(replace(replacements[1].from, replacements[1].to))
    .pipe(concat('qmlweb.parser.covered.js'))
    .pipe(iife({
      useStrict: false,
      params: ['exports'],
      args: ['typeof exports !== \'undefined\' ? exports : window']
    }))
    .pipe(changed('./tmp'))
    .pipe(gulp.dest('./tmp'));
});

gulp.task('build-dev', function() {
  return gulp.src(sources)
    .pipe(order(sources, { base: __dirname }))
    .pipe(sourcemaps.init())
    .pipe(replace(replacements[0].from, replacements[0].to))
    .pipe(replace(replacements[1].from, replacements[1].to))
    .pipe(concat('qmlweb.parser.js'))
    .pipe(iife({
      useStrict: false,
      params: ['exports'],
      args: ['typeof exports !== \'undefined\' ? exports : window']
    }))
    .pipe(changed('./lib'))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./lib'));
});

gulp.task('build', ['build-dev'], function() {
  return gulp.src('./lib/qmlweb.parser.js')
    .pipe(concat('qmlweb.parser.min.js'))
    .pipe(changed('./lib'))
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(uglify())
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./lib'));
});

gulp.task('watch', ['build'], function() {
  gulp.watch(sources, ['build']);
});

gulp.task('watch-dev', ['build-dev'], function() {
  gulp.watch(sources, ['build-dev']);
});

gulp.task('default', ['watch']);
