const isFunction = func => {
  return func && ({}).toString.call(func) === '[object Function]';
};

const alreadyFinalized = () => {
  return new Error('promise was already finalized ');
};

const finalize = (share, err = null) => {
  share.isFinalized = true;
  share.finalizer(err)
};

const process = (share, id) => {
  let index = share.chain.indexOf(id);
  share.chain.splice(0, index + 1);

  if (!share.chain.length) {
    finalize(share);
  }
};

const isPromise = obj => (obj && isFunction(obj.then)) ? true : false;

const resolve = (share, onFulfilled, result) => {
  let resolved = null;
  if (share.chain.indexOf('catch') != -1) {
    resolved = onFulfilled(result);
  } else {
    try {
      resolved = onFulfilled(result);
    } catch (err) {
      console.warn('(then) Unhandled Finalized Promise error: ', err.message);

      //share.isFinalized = true;
      //share.finalize(err);
      finalize(share, err);

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

      //share.isFinalized = true;
      //share.finalize(err);
      finalize(share, err);

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
    finalizer: null,
    chain: []
  };

  constructor(body, finalizer) {
    if (finalizer && !isFunction(finalizer)) {
      throw new Error('finalizer should be a function');
    }

    if (!finalizer) {
      finalizer = () => {
        console.warn('empty finalizer');
      }
    }

    super((resolve, reject) => {
      const finalizeResolve = (response) => {
        resolve(response);
          
        if (!this.share.isFinalized  && this.share.chain.length == 0) {
          if (isPromise(response)) {
             response.then(() => {
               finalize(this.share, null);
             });
          } else {
           finalize(this.share, null); 
          }
        }
      };

      const finalizeReject = (err = null) => {
        reject(err);

        if (this.share.chain.indexOf('catch') == -1) {
          this.share.chain.splice(0, 1);
        }

        if (!this.share.isFinalized && this.share.chain.length == 0) {
           if (isPromise(response)) {
             response.then(()) => {
               finalize(this.share, err);
             });
          } else {
           finalize(this.share, err); 
          }
        }
      };

      body(finalizeResolve, finalizeReject);
    });

    Object.assign(this.share, {
      finalizer
    });
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

  static resolve(promise, finalizer) {
    return new FinalizePromise(resolve => setImmediate(() => {
      resolve(promise)
    }), finalizer);
  }

  static reject(promise, finalizer) {
    return new FinalizePromise((resolve, reject) => setImmediate(() => {
      reject(promise)
    }), finalizer);
  }
}
