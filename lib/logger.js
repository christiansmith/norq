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

var winston = require('winston')
  , util = require('util');

/**
 * Initialize an array of Winston transport 
 * objects based on config.logs
 */

function configure (logs) {
  logs = logs || [];
  return logs.map(function (log) {
    return (typeof log === 'object') 
      ? new (winston.transports[log.transport])(log.options)
      : new (winston.transports[log]);
  });
};

exports.configure = configure; 

/**
 * Configure Winston Logger and return logger middleware
 *
 * Example config JSON for logging;
 *
 * var config = { 
 *     name:  '...'
 *   , redis: {...}
 *   , http:  { port: 5150 }
 *   , model: {...}
 *   , logs:  [ 'Console'
 *            , { transport: 'File'  
 *              , options: { filename: 'test/winston.log' }} ]      
 * };
 *
 * config.logs needs to be an array. 
 */

function logger (config) {
  
  config = config || {};
  var transports = configure(config.logs || []);

  var logs = new (winston.Logger)({
    transports: transports
  });

  // logger middleware
  return function logger (req, res, next) {
    var send = res.send
      , entry = {
          ip: req.client.remoteAddress
        , url: req.url
        , method: req.method
        , agent: req.headers['user-agent'] };

    // wrap res.send with logging
    res.send = function (body, headers, status) {
      res.send = send;
      res.send(body, headers, status);

      entry.status = status || headers;

      var message = entry.method + ' ' + entry.url + ' ' + entry.status;
      
      (body instanceof Error)
        ? entry.error = body.message
        : entry.body = body;
      
      (entry.status >= 400)
        ? logs.error(message, entry)
        : logs.info(message);

    }
    next();
  };

};

exports.logger = logger; 
