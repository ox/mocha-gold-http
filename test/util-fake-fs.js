class FakeFS {
  constructor() {
    this.fs = {};
  }

  mkdirSync(path) {
    this.fs[path] = true;
  }

  existsSync(path) {
    return !!this.fs[path];
  }

  readFileSync(path) {
    if (this.fs[path]) {
      return this.fs[path].content;
    }
    throw new Error(`ENOENT: ${path} does not exist`);
  }

  writeFileSync(path, content) {
    const now = new Date();
    const existingBirthtime = this.fs[path] && this.fs[path].birthtime;
    const stat = {atime: now, mtime: now, birthtime: existingBirthtime || now};
    this.fs[path] = {content, stat};
  }

  lstatSync(path) {
    if (this.fs[path]) {
      return this.fs[path].stat;
    }
    throw new Error(`ENOENT: ${path} does not exist`);
  }

  utimesSync(path, atime, mtime) {
    if (this.fs[path]) {
      this.fs[path].stat.atime = atime;
      this.fs[path].stat.mtime = mtime;
      return;
    }
    throw new Error(`ENOENT: ${path} does not exist`);
  }

  restore() {
    this.fs = {};
  }
}

let fakeFs;

function init(sandbox, fs) {
  fakeFs = new FakeFS();

  sandbox.stub(fs, 'mkdirSync').callsFake(fakeFs.mkdirSync.bind(fakeFs));
  sandbox.stub(fs, 'existsSync').callsFake(fakeFs.existsSync.bind(fakeFs));
  sandbox.stub(fs, 'readFileSync').callsFake(fakeFs.readFileSync.bind(fakeFs));
  sandbox.stub(fs, 'writeFileSync').callsFake(fakeFs.writeFileSync.bind(fakeFs));
  sandbox.stub(fs, 'lstatSync').callsFake(fakeFs.lstatSync.bind(fakeFs));
  sandbox.stub(fs, 'utimesSync').callsFake(fakeFs.utimesSync.bind(fakeFs));
}

function restore() {
  fakeFs.restore();
}

module.exports = {
  init,
  restore,
  fs: fakeFs,
  FakeFS,
};
