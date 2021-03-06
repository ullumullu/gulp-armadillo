//////////////////////////////
// Nunjucks
//  - A Gulp Plugin
//
// Builds Nunjucks to HTML
//////////////////////////////
'use strict';

//////////////////////////////
// Variables
//////////////////////////////
var through = require('through2'),
    gutil = require('gulp-util'),
    path = require('path'),
    fs = require('fs-extra'),
    dateformat = require('dateformat'),
    fm = require('front-matter'),
    marked = require('./markdown'),
    PluginError = gutil.PluginError,
    PLUGIN_NAME = 'nunjucks',
    gulpNunjucks;

//////////////////////////////
// Set Nunjucks stuff
//////////////////////////////


//////////////////////////////
// Export
//////////////////////////////
gulpNunjucks = function (options) {
  options = options || {};

  var nunjucks = gulpNunjucks.compiler;
  var nunjucksPaths = options.paths;
  var nunjucksEnv;

  var _this  = this;

  var filterError = function (e) {
    var message = new gutil.PluginError(PLUGIN_NAME, e.message);
    _this.emit('error', message);
  };

  nunjucksEnv = nunjucks.configure(nunjucksPaths, {
    'noCache': true
  });

  //////////////////////////////
  // Nunjucks Filters and Tags
  //////////////////////////////
  nunjucksEnv.addFilter('attributes', function (file, attribute) {
    try {
      var content;
      file = fs.readFileSync(path.join(process.cwd(), file));

      content = fm(file.toString());

      if (content.attributes) {
        if (attribute) {
          return content.attributes[attribute];
        }
        else {
          return content.attributes;
        }
      }
      else {
        return {};
      }

      return file;
    }
    catch (e) {
      filterError(e);
    }
  });

  nunjucksEnv.addFilter('body', function (file, attribute) {
    try {
      var content;
      file = fs.readFileSync(path.join(process.cwd(), file));

      return content = fm(file.toString()).body;
    }
    catch (e) {
      filterError(e);
    }
  });

  nunjucksEnv.addFilter('render', function (file) {
    try {
      var content = fs.readFileSync(path.join(process.cwd(), file)),
        matter = fm(content.toString());

      content = matter.body;

      if (path.extname(file) !== '.html') {
        content = marked(content);
      }

      return nunjucksEnv.renderString(content, matter.attributes);
    }
    catch (e) {
      filterError(e);
    }
  });

  nunjucksEnv.addFilter('markdown', function (content) {
    try {
      return marked(content);
    }
    catch (e) {
      filterError(e);
    }
  });

  nunjucksEnv.addFilter('date', function (content, format) {
    try {
      return dateformat(content, format);
    }
    catch (e) {
      filterError(e);
    }
  });

  // Iterate over all custom defined filters and add them
  Object.keys(options.filters).forEach(function (filter) {
    nunjucksEnv.addFilter(filter, options.filters[filter]);
  });

  // Iterate over all custom defined tags and add them
  Object.keys(options.tags).forEach(function (tag) {
    nunjucksEnv.addExtension(tag, options.tags[tag]);
  });

  //////////////////////////////
  // Command line arguments for each option
  //////////////////////////////
  process.argv.forEach(function (val, index, array) {
    if (index >= 3) {
      switch (val) {
        case '--fail': options.failOnError = true; break;
      }
    }
  });

  //////////////////////////////
  // Through Object
  //////////////////////////////
  var compile = through.obj(function (file, encoding, cb) {
    var ext = path.extname(file.path),
        context = {};

    _this = this;

    /////////////////////////////
    // Default plugin issues
    //////////////////////////////
    if (file.isNull()) {
      return cb();
    }
    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
      return cb();
    }

    //////////////////////////////
    // Manipulate Files
    //////////////////////////////
    if (ext === '.html') {
      if (file.meta) {
        context = file.meta;
        context.filename = file.path;

        if (!file.meta.published) {
          context.published = file.stat.birthtime;
        }
        if (!file.meta.updated) {
          context.updated = file.stat.mtime;
        }

        context.stats = file.stat;
        context.global = options.variables;

        // If a template exists in the meta info, build a content block and extend for it
        try {
          if (file.meta.template) {
            file.contents = new Buffer(nunjucksEnv.renderString(
              '{% extends "' + file.meta.template + '" %}' +
              '{% block content %}' + file.contents.toString() + '{% endblock %}'
              , context)
            );
          }
          // Otherwise, just render it!
          else {
            file.contents = new Buffer(nunjucksEnv.renderString(file.contents.toString(), context));
          }
        }
        catch (e) {
          filterError(e);
        }
      }
    }

    //////////////////////////////
    // Push the file back to the stream!
    //////////////////////////////
    this.push(file);

    //////////////////////////////
    // Callback to tell us we're done
    //////////////////////////////
    cb();
  })

  return compile;
}

gulpNunjucks.compiler = require('nunjucks');

gulpNunjucks.filters = {};
gulpNunjucks.tags = {};
gulpNunjucks.paths = [];

module.exports = gulpNunjucks;
