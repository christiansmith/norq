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
  , logger = require('./lib/logger').logger;

/**
 * Export norq
 */

module.exports = norq; 

/**
 * Default config
 * 
 * Is there a concise way to merge norq.config with defaults? 
 * JS is great but I'm sometimes missing Clojure...
 */

var defaults = module.exports.defaults = {
    name: 'default'
  , redis: { host: '127.0.0.1', port: 6379 }
  , http: { port: 5150 }
  , logs: [ 'Console'
          , { transport: 'File'
            , options: { filename: 'logs/http.log' }}]
  , model: {
      default: {
        name: 'default'
      , options: {}
    }  
  }
}

/**
 * Load config from norq.json file
 */

var custom = (function (path) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (err) {
    return err;
  }
})('./norq.json');

/**
 * Merge custom into defaults, overriding defaults
 */

function mergeConfig (defaults, custom) {
  var config = {};
  for (property in defaults) { config[property] = defaults[property]; }
  for (property in custom) { config[property] = custom[property]; }
  return config;
}

module.exports.config = mergeConfig(defaults, custom); 

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
