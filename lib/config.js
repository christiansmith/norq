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

var fs = require('fs');

/**
 * Defaults
 */

var defaults = {
  redis: {
    host: '127.0.0.1',
    port: 6379,
    db: 9,
    options: {}
  },  
  http: { 
    port: 5150      
  },
  logs: [
    'Console',
    { transport: 'File',
      options: { filename: 'logs/http.log' }} 
  ],
  model: {
    default: {
      name: 'default'
    },
  }
};

module.exports.defaults = defaults; 

/**
 * Read JSON from a file
 */

function read (path) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (err) {
    return { error: err };
  }
}

module.exports.read = read; 

/**
 * Merge JSON into defaults
 */

function merge (obj) {
  var merged = {};
  for (prop in defaults) { merged[prop] = defaults[prop] };
  for (prop in obj) { merged[prop] = obj[prop] };
  return merged;
}

module.exports.merge = merge; 

/**
 * Load JSON from file and merge with defaults
 */

module.exports.load = function load (path) {
  // we want to add some kind of error handling 
  var config = read(path);
  return merge(config);
};
