// @flow

import ExtendableError from './ExtendableError';

class NotFoundError {
  constructor(item: string, collection: string, id: string) {
    this.message = `${item}(${id}) not found`;
  }
}

export default NotFoundError;
