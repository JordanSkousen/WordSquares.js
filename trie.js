const NUM_LETTERS = 26;

class Iter {
  n;
  ix = -1;

  constructor(nodes) {
    this.n = nodes;
  }
  getIx () {
    return this.ix;
  }
  getLetter() {
    return String.fromCharCode(this.ix + "A".charCodeAt(0));
  }
  get() {
    return this.n[this.ix];
  }
  next() {
    while (true) {
      this.ix++;
      if (this.ix >= NUM_LETTERS) { return false; }
      if (this.n[this.ix]) { return true; }
    }
  }
}

class Trie {
  nodes;

  constructor() {
    this.nodes = new Array(NUM_LETTERS).fill(null);
  }
  add(str) {
    let ptr = this;
    for (const c of str) {
      const ix = c.charCodeAt(0) - "A".charCodeAt(0);
      if (ix < 0 || ix >= NUM_LETTERS) {
        throw new Error("Invalid character: " + c);
      }
      if (!ptr.nodes[ix]) {
        ptr.nodes[ix] = new Trie();
      }
      ptr = ptr.nodes[ix];
    }
  }
  has(str) {
    let ptr = this;
    for (const c of str) {
      const ix = c.charCodeAt(0) - "A".charCodeAt(0);
      if (ix < 0 || ix >= NUM_LETTERS) {
        throw new Error("Invalid character: " + c);
      }
      if (!ptr.nodes[ix]) { return false; }
      ptr = ptr.nodes[ix];
    }
    return true;
  }
  hasIx(ix) { return this.nodes[ix]; }
  hasLetter(c) { return this.nodes[c.charCodeAt(0) - "A".charCodeAt(0)]; }
  decend (ix) { return this.nodes[ix]; }
  
  iter() { return new Iter(this.nodes); }
}
exports.Trie = Trie;