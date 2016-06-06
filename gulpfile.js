const gulp = require('gulp');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const changed = require('gulp-changed');
const order = require('gulp-order');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const iife = require('gulp-iife');

const replacements = require('./src/replacements');

const sources = [
  'src/header.js',
  'node_modules/uglify-js/lib/parse-js.js',
  'src/api.js',
];

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
             .pipe(rename('qmlweb.parser.min.js'))
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
