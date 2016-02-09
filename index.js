const alreadyFinalized = () => {
  return new Error('promise was already finalized ');
};

const process = (share, id) => {
  let index = share.chain.indexOf(id);
  share.chain.splice(0, index + 1);

  if (!share.chain.length) {
    share.isFinalized = true;
    share.finalize();
  }
};

const isPromise = obj => obj && obj.then;

const resolve = (share, onFulfilled, result) => {
  let resolved = null;
  if (share.chain.indexOf('catch') != -1) {
    resolved = onFulfilled(result);
  } else {
    try {
      resolved = onFulfilled(result);
    } catch (err) {
      console.warn('(then) Unhandled Finalized Promise error: ', err.message);

      share.isFinalized = true;
      share.finalize(err);

      throw err;
    }
  }

  if (isPromise(resolved)) {
    return resolved.then(result => {
      process(share, 'then');

      return result;
    });
  } else {
    process(share, 'then');

    return resolved;
  }
};

const reject = (share, onRejected, err) => {
  let resolved = null;
  if (share.chain.indexOf('catch') != -1) {
    resolved = onRejected(err);
  } else {
    try {
      resolved = onRejected(err);
    } catch (err) {
      console.warn('(catch) Unhandled Finalized Promise error: ', err.message);

      share.isFinalized = true;
      share.finalize(err);

      throw err;
    }
  }

  if (isPromise(resolved)) {
    return resolved.then((result) => {
      process(share, 'catch');

      return result;
    });
  } else {
    process(share, 'catch');

    return resolved;
  }
};

export default class FinalizePromise extends Promise {
  share = {
    increment: 0,
    isFinalized: false,
    finalize: null,
    chain: []
    //methods: []
  };

  constructor(body, finalize) {
    super(body);
    this.share.finalize = finalize;
  }

  then(onFulfilled, onRejected) {
    if (this.share.isFinalized) {
      throw alreadyFinalized();
    }

    let promise = null;

    if (onFulfilled && onRejected) {
      this.share.chain.push('then');
      this.share.chain.push('catch');

      promise = super.then(result => {
        return resolve(this.share, onFulfilled, result);
      }, err => {
        return reject(this.share, onRejected, err);
      });

    } else if (onFulfilled) {
      this.share.chain.push('then');

      promise = super.then(result => {
        return resolve(this.share, onFulfilled, result);
      });

    } else if (onRejected) {
      this.share.chain.push('catch');

      promise = super.then(null, err => {
        return reject(this.share, onRejected, err);
      });
    }

    this.share.increment++;

    Object.assign(promise, {
      share: this.share
    });

    return promise;
  }
}
