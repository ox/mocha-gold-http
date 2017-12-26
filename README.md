[![npm](https://img.shields.io/npm/v/mocha-gold-http.svg?style=flat-square)](https://www.npmjs.com/package/mocha-gold-http)
[![Build Status](https://travis-ci.org/ox/mocha-gold-http.svg?branch=master)](https://travis-ci.org/ox/mocha-gold-http)

# Mocha Gold HTTP

This plugin enables golding of responses with configurable refresh times to enable offline testing
of remote resources. The golds will be written to disk and are meant to be kept in your source tree.

When calling `mocha-gold-http`'s mocked request, it follows the following checks:

- check if there is a response file recorded for the given url
- if the file exists and is fresh enough, return that response
- if the file exists and needs to be refreshed, fetch the given url and write the response to disk
  - if the upstream status code differs from the one on disk, warn and return the response on disk
- if the requested route is not requested to be golded, throw an error

## Usage

`mocha-gold-http`'s [tests](glob/master/test) demonstrate how to use the plugin.

```js
const Golder = require('mocha-gold-http');
const assert = require('assert');
const sinon = require('sinon');
const axios = require('axios');

// sandbox is optional; can use `sinon` itself since the methods called are the same
const sandbox = sinon.createSandbox(sinon.defaultConfig);

describe('some test', function () {
  const opts = {
    name: 'some test',
    routes: {
      homepage: {
        url: 'https://www.npmjs.com',
        refresh: 'weekly',
      },
    },
  };
  const golder = new Golder(opts);

  // NOTE: require to make sure Linux has enough time to flush to disk
  this.timeout(30000);
  beforeEach(() => golder.mockRequest(sandbox, axios));
  afterEach(() => sandbox.restore());

  it('can fetch remote pages', function () {
    return axios.get(opts.routes.homepage.url)
      .then((response) => {
        // test the response as if you made a network call
	      assert.equal(response.statusCode, 200);
      });
  });
});
```

## Roadmap and Development

Currently this library covers the bare minimum for what I would like in a
golding tool, but I'm sure there are plenty of other features and edge cases to
be considered. I would like some answers to the following questions:

- the library currently has a preference for a particular request lib, should it be more generic?
- there is a strange hang-up that needs addressing ([#1](https://github.com/ox/mocha-gold-http/issues/1))
- can the API be streamlined? (~~[#2](https://github.com/ox/mocha-gold-http/issues/2)~~)
- is the name too specific or misleading?

## Contributing

PRs and Issues are gladly accepted! Please create an Issue first before submitting
a PR so there may be a place to discuss what the solution should look like.

When submitting code, make sure it passes tests (`npm run test`) and linting
checks (`npm run lint`).
