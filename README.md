# Norq

A loosely-ordered random-access queue for JSON documents implemented with Node and Redis.

## Features

  * Use Norq as a library, command line tool, preloaded in a repl, or via HTTP
  * Optionally validate your data with json-schema.
  * Flexible logging from HTTP with Winston

## Installation

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

You can define any number of queues in the model, each with its own schema.

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

For more information on json-schema see: [link]

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

    // In your norq project directory
    $ norq http

    // then access with curl or whatever

    // view the model for a queue
    $ curl http://<host:port>/<queue>

    // push
    $ curl -XPOST http://localhost:5150/queue -d '{...}' -H 'Content-Type: application/json'

    // peek

    // pop

    // range

    // etc

## Running the Tests

  Get the source from GitHub, then in the root directory:

  $ nodeunit test/test-norq.js test/test-logger.js test/test-config.js
  $ expresso test/test-http.js

## Acknowledgements

  Thanks to my friends and family for all your support and encouragement.

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
