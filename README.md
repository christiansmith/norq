# Norq

A loosely-ordered random-access queue for JSON documents implemented with Node and Redis.

## Features

  * Use Norq as a library, command line tool, preloaded in a repl, or via HTTP
  * Optionally validate your data with json-schema.
  * Flexible logging from HTTP with Winston

## Installation

Install globally to use the norq executable:

    $ npm install -g norq

Install locally to use norq as a dependency:

    $ npm install norq

## Configuration

Norq looks for a config file called `norq.json` in the working directory. The command `$ norq init` will generate a file with the default configuration. It looks like this:

    {
      "redis": {
        "host": "127.0.0.1",
        "port": 6379,
        "db": 9,
        "options": {}
      },
      "http": {
        "port": 5150
      },
      "logs": [
        "Console",
        { "transport": "File",
          "options": { "filename": "logs/http.log" }}
      ],
      "model": {
        "default": {
          "name": "default"
        }
      }
    }

You can define any number of queues in the model, each with its own [json-schema](http://json-schema.org/).

    // ...
    "model": {
      "resources": {
        "name": "resources",
        "schema": {
          "type": "object",
          "properties": {
            // ...  
          }
        }
      }
    }
    // ...


## Usage

    // this creates norq.conf and log/
    // you probably want to do it in a new directory
    $ norq init 

    // help
    $ norq help
    $ norq --help
    $ norq -h

    // version
    $ norq version
    $ norq --version
    $ norq -v

### Norq commands:

  * push <queue> <json> 
  * peek <queue>
  * pop <queue>
  * size <queue>
  * range <queue> <start> <end>
  * head <queue> <length>
  * tail <queue> <length>
  * page <queue> <page> <size>
  * get <queue> <id>
  * set <queue> <id> <json>
  * remove <queue> <id>
  * flush <queue|all>

  Examples with default config:

    $ norq push default '{ "some": "data" }'
    $ norq peek default


### Use Norq as a library

    var norq = require('norq')
      , client = norq.createClient({...});

    // all norq commands are methods that take a callback as their last argument
    client.push('queue-name', {...}, function (err, result) {
      // do your thing 
    });

### Use Norq in a repl

    $ norq repl
    norq> 

    // Your configuration will be loaded for you along with 
    // norq and client, and a standard callback called norq.print
    norq> norq.peek('queue', norq.print)
    ...

### Use Norq from the command line (Unix/Linux/Mac)

    $ norq help
    $ norq version
    $ norq push queue '{...}' 
    $ norq peek queue 
    etc.

### Use Norq over HTTP

In your norq project directory start a HTTP server

    $ norq http

Then access with curl or whatever client you want. Content-Type of HTTP PUT requests has to be application/json. For example:

    $ curl -XPOST http://localhost:5150/queue -d '{...}' -H 'Content-Type: application/json'

HTTP API

    Instance information

    server    GET /
    model     GET /model
    schema    GET /<queue>/schema

    Queue operations

    push      PUT /<queue>
    peek      GET /<queue>
    pop       DEL /<queue>

    List operations

    head      GET /<queue>/head?limit=100     // limit defaults to 10
    tail      GET /<queue>/tail?limit=100
    range     GET /<queue>/25..49

    Random access

    set       PUT /<queue>/<id>
    get       GET /<queue>/<id>
    remove    DEL /<queue>/<id>


## Running the Tests

  Get the source from GitHub, install nodeunit and expresso globally, then in the root directory:

  $ nodeunit test/test-norq.js test/test-logger.js test/test-config.js
  $ expresso test/test-http.js

## Acknowledgements

  Thanks to the open source software community for sharing your work. Norq is built with:

  * Node.js and Redis (of course)
  * node_redis
  * node-uuid
  * express
  * winston
  * ...

## Support Norq

Norq is free software. I hope it serves you well. If you are using Norq in production, or feel that you are deriving value from it in some way, please consider sponsoring my work with a donation via PayPal.  

## License

Copyright (c) 2011 Christian Smith &lt;smith@anvil.io&gt; 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE.
