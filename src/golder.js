const Promise = require('bluebird');
const request = require('request-promise');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const differences = {
  monthly: 2629740000,
  weekly: 604800000,
  daily: 86400000,
  hourly: 3600000,
};

/**
 * Replaces non-alphanumeric characters with dashes
 * @param {string} name
 * @returns {string}
 */
function sanitize(name) {
  return name.trim().replace(/[^a-zA-Z0-9]/g, '-');
}

class Golder {
  constructor({ name, routes = {} } = {}) {
    assert(name, 'Golder requires a `name`');
    if (routes) {
      Object.entries(routes).forEach(([route, opts]) => {
        const { refresh } = opts;
        if (refresh && !differences[refresh]) {
          const list = Object.keys(differences).join(', ');
          const msg = `Golder ${name}'s ${route} refresh rate '${refresh}' is not one of ${list}`;
          assert(differences[refresh], msg);
        }
      });
    }

    this.name = name;
    this.routes = routes;
    this.urlToFile = {};
    const goldsDir = path.join(process.cwd(), 'test', 'golds');

    this.folderName = sanitize(name);
    this.folderPath = path.join(goldsDir, this.folderName);

    const foldersToMake = [
      goldsDir,
      this.folderPath,
    ];

    foldersToMake.forEach((folder) => {
      try {
        fs.mkdirSync(folder);
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
    });

    Object.entries(routes).forEach(([route, opts]) => {
      assert(opts.url, `Golder ${name}'s ${route} is missing a url param`);
      const fileName = sanitize(route);
      this.urlToFile[opts.url] = path.join(this.folderPath, `${fileName}.html`);
    });
  }

  /**
   * Gold all routes for this gold test suite passed during creation.
   * @returns {Promise<Array[void]>}
   */
  gold() {
    return Promise.map(Object.entries(this.routes), ([route, opts]) => {
      assert(opts.url, `url missing for route ${route} in Golder ${this.name}`);
      const filePath = path.join(this.folderPath, `${route}.html`);
      const exists = fs.existsSync(filePath);
      let shouldReGold = false;

      if (!exists) {
        shouldReGold = true;
      } else if (exists && opts.refresh) {
        const mtime = fs.lstatSync(filePath);
        const now = new Date();
        const age = now - mtime;

        if (age > differences[opts.refresh]) {
          shouldReGold = true;
        }
      }

      return shouldReGold ? this.goldRoute(route, opts) : Promise.resolve();
    });
  }

  goldRoute(route, opts) {
    assert(opts.url, `url missing for route ${route} in Golder ${this.name}`);

    // TODO(artem): gold when the route is requested, to be able to use all request opts
    return request.get({
      uri: opts.url,
      resolveWithFullResponse: true,
    }).then((response) => {
      const filePath = path.join(this.folderPath, `${route}.html`);
      const code = response.statusCode;
      const exists = fs.existsSync(filePath);

      // if the response code is not OK and the current file exists, warn that the re-golding
      // cannot be completed
      if (code >= 400 && exists) {
        const current = fs.readFileSync(filePath);

        if (current.statusCode !== code) {
          const msg = `re-golding ${opts.url} returned code ${code}, using expired response`;
          // eslint-disable-next-line no-console
          console.warn(msg);
          return Promise.resolve();
        }
      } else if (code >= 400) {
        throw new Error(`GET ${opts.url} returned code ${code}; cannot gold`);
      }

      // QUESTION(artem): is there a need to gold 4XX responses?
      const body = JSON.stringify(response, null, 2);
      return new Promise((resolve, reject) => {
        fs.writeFile(filePath, body, (err) => {
          return err ? reject(err) : resolve();
        });
      });
    });
  }

  mockRequest(sandbox, req) {
    sandbox.stub(req, 'get').callsFake((pathOrOpts) => {
      let opts = { uri: pathOrOpts };

      if (_.isObject(pathOrOpts)) {
        assert(pathOrOpts.uri);
        opts = Object.assign({}, pathOrOpts, { resolveWithFullResponse: true });
      }

      const filePath = this.urlToFile[opts.uri];
      if (!fs.existsSync(filePath)) {
        // QUESTION(artem): what if this.goldRoute() is called here, and all requests are golded?
        throw new Error(`Golder ${this.name} doesn't gold ${opts.uri}`);
      }

      const response = JSON.parse(fs.readFileSync(filePath));
      return Promise.resolve(response);
    });
  }
}

module.exports = Golder;
