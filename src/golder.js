const Promise = require('bluebird');
const axios = require('axios');

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
  constructor({name, routes = {}} = {}) {
    assert(name, 'Golder requires a `name`');
    if (routes) {
      Object.entries(routes).forEach(([route, opts]) => {
        const {refresh} = opts;
        if (refresh && !differences[refresh]) {
          const list = Object.keys(differences).join(', ');
          const msg = `Golder ${name}'s ${route} refresh rate '${refresh}' is not one of ${list}`;
          assert(differences[refresh], msg);
        }
      });
    }

    this.name = name;
    this.routes = routes;
    this.axios = axios.create({});
    this.urlToRoute = {};
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
      this.urlToRoute[opts.url] = {
        filePath: path.join(this.folderPath, `${fileName}.html`),
        opts,
      };
    });
  }

  readGold(filePath) {
    return fs.readFileSync(filePath);
  }

  writeGold(filePath, body) {
    fs.writeFileSync(filePath, body);
  }

  mockRequest(sandbox, req) {
    const fn = (pathOrOpts) => {
      const reqOpts = {method: 'get', url: pathOrOpts};

      if (_.isPlainObject(pathOrOpts)) {
        Object.assign(reqOpts, pathOrOpts, {url: pathOrOpts.url});
      }

      const {filePath, opts} = this.urlToRoute[reqOpts.url];
      const goldExists = fs.existsSync(filePath);
      let useGold = goldExists;
      if (goldExists && opts.refresh) {
        const {mtime} = fs.lstatSync(filePath);
        const age = new Date() - mtime;
        useGold = age < differences[opts.refresh];
      }
      if (useGold) {
        const response = JSON.parse(this.readGold(filePath));
        return Promise.resolve(response);
      }

      return this.axios(opts)
        .then((response) => {
          const {status} = response;
          delete response.request;

          // if the response code is not OK and the current file exists, warn that the re-golding
          // cannot be completed
          if (status >= 400 && goldExists) {
            const current = this.readGold(filePath);

            if (current.status !== status) {
              const msg = `re-golding ${reqOpts.url} returned code ${status}; using expired response`;
              console.warn('WARN:', msg); // eslint-disable-line no-console
              return Promise.resolve();
            }
          } else if (status >= 400) {
            throw new Error(`GET ${reqOpts.url} returned code ${status}; cannot gold`);
          }

          // QUESTION(artem): is there a need to gold 4XX responses?
          const body = JSON.stringify(response, null, 2);
          this.writeGold(filePath, body);
          return Promise.resolve();
        });
    };

    if (_.isFunction(req.get.restore)) {
      req.get.restore();
    }
    sandbox.stub(req, 'get').callsFake(fn);
  }
}

module.exports = Golder;
