/*!
 * Norq
 * Copyright(c) 2011 Christian Smith <smith@anvil.io>
 * MIT Licensed
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
