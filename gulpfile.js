const gulp = require('gulp');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const changed = require('gulp-changed');
const order = require('gulp-order');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const iife = require('gulp-iife');

const sources = [
  'src/header.js',
  'node_modules/uglify-js/lib/parse-js.js',
  'src/api.js',
];

gulp.task('build-dev', function() {
  return gulp.src(sources)
             .pipe(order(sources, { base: __dirname }))
             .pipe(sourcemaps.init())
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
