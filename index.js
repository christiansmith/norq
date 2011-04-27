/*
 * Copyright(c) 2011 Christian Smith <smith@anvil.io>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * Module dependencies.
 */

var fs = require('fs')
  , norq = require('./lib/norq')
  , http = require('./lib/http')
  , config = require('./lib/config')
  , logger = require('./lib/logger').logger;

/**
 * Export norq
 */

module.exports = norq; 

/**
 * Export config and defaults
 */

module.exports.defaults = config.defaults;
module.exports.config = config.load('./norq.json');

/**
 * Helper function for repl and shell commands
 */

module.exports.print = function (err, result) {
  if (err) {
    console.log(err);
  } else {
    console.log(result);
  }
};

/**
 * Initialize an http server instance based on config
 */

module.exports.createServer = function createServer (config) {
  var middleware = { route: '', handle: logger(config) };
  http.stack.splice(2, 0, middleware);
  http.norq_client.model = config.model;
  return http;
};
